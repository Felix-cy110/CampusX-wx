var requestModule = require('../../utils/request')
var request = requestModule.request
var getBaseUrl = requestModule.getBaseUrl
var handleAuthFailure = require('../../utils/auth').handleAuthFailure

var createStompClient = null
try {
  var stompModule = require('./stomp')
  createStompClient = stompModule.createStompClient
} catch (e) {
  console.error('[Chat] stomp.js 模块加载失败:', e)
}

var app = getApp()

Page({
  data: {
    messages: [],
    inputValue: '',
    scrollToView: 'msg-bottom',
    otherAvatar: '',
    otherName: '聊天',
    myAvatar: '',
    isFollowed: false,
    statusBarHeight: 0,
    navBarHeight: 0,
    showPanel: false,
    toastVisible: false,
    toastText: '',
    cursor: null,
    lastId: null,
    hasMore: false,
    loadingMore: false,
    loading: true,
    loadFailed: false,
    conversationId: '',
    otherUserId: null,
    orderId: null,
    orderType: null,
    _pendingMsgIds: {},
    pageError: false,
    errorMsg: ''
  },

  onLoad: function (options) {
    try {
      var systemInfo = wx.getSystemInfoSync()
      var menuButton = wx.getMenuButtonBoundingClientRect()
      var statusBarHeight = systemInfo.statusBarHeight
      var navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

      var convId = (options && options.convId) ? options.convId : ''
      var otherUserId = (options && options.userId) ? Number(options.userId) : null
      var orderId = (options && options.orderId) ? Number(options.orderId) : null
      var orderType = (options && options.orderType) ? Number(options.orderType) : null
      var otherName = '聊天'
      if (options && options.name) {
        try {
          otherName = decodeURIComponent(options.name)
        } catch (e) {
          otherName = options.name
        }
      }
      var otherAvatar = ''
      if (options && options.avatar) {
        try {
          otherAvatar = decodeURIComponent(options.avatar)
        } catch (e) {
          otherAvatar = options.avatar
        }
      }

      var userInfo = app.globalData.userInfo || {}
      var myUid = userInfo.uid || ''
      var myAvatar = userInfo.avatar || '/images/avatars/default.png'

      this.setData({
        otherName: otherName,
        otherAvatar: otherAvatar,
        myAvatar: myAvatar,
        myUid: String(myUid),
        statusBarHeight: statusBarHeight,
        navBarHeight: navBarHeight,
        conversationId: convId,
        otherUserId: otherUserId,
        orderId: orderId,
        orderType: orderType
      })

      if (otherUserId) {
        this.checkFollowStatus()
      }

      if (convId) {
        this.loadHistory()
      } else if (otherUserId) {
        this.loadHistoryByUser()
      } else {
        this.setData({ loading: false })
      }

      try {
        this.connectStomp()
      } catch (err) {
        console.error('[Chat] 连接 WebSocket 失败:', err)
      }
    } catch (err) {
      console.error('[Chat] onLoad error:', err)
      this.setData({
        pageError: true,
        errorMsg: err.message || '页面加载失败',
        loading: false
      })
    }
  },

  onUnload: function () {
    try {
      if (this._stompClient) {
        this._stompClient.disconnect()
        this._stompClient = null
      }
    } catch (e) { }
    // 返回时立即从缓存刷新 tabBar badge（零延迟），再异步刷新
    var tabBar = getApp().globalData._tabBar
    if (tabBar) {
      tabBar.updateBadgeFromGlobalData()
      tabBar.loadInboxBadge()
    }
  },

  onShow: function () {
    // 从其他页面返回时刷新关注状态
    if (this.data.otherUserId) {
      this.checkFollowStatus()
    }
  },

  loadHistory: function () {
    var that = this
    var params = {
      conversationId: this.data.conversationId,
      size: 20
    }
    if (this.data.cursor) {
      params.cursor = this.data.cursor
      params.lastId = this.data.lastId
    }

    request({
      url: '/api/v1/chat/messages',
      method: 'GET',
      data: params
    }).then(function (result) {
      var list = result.messages || []
      var messages = list.map(function (msg) { return mapMessage(msg, that.data.myUid) })
      messages.reverse()

      if (that.data.cursor) {
        var newList = messages.concat(that.data.messages)
        that.setData({
          messages: newList,
          cursor: result.nextCursor || null,
          lastId: result.nextId || null,
          hasMore: result.hasMore !== false,
          loadingMore: false,
          loading: false,
          loadFailed: false
        })
      } else {
        that.setData({
          messages: messages,
          cursor: result.nextCursor || null,
          lastId: result.nextId || null,
          hasMore: result.hasMore !== false,
          loading: false,
          loadFailed: false,
          scrollToView: 'msg-bottom'
        })
        setTimeout(function () { that.scrollToBottom() }, 300)
      }
    }).catch(function (err) {
      console.error('加载聊天历史失败:', err)
      that.setData({
        loading: false,
        loadFailed: true,
        loadingMore: false
      })
    })
  },

  /** 通过用户ID加载聊天历史（无会话ID时的回退方案） */
  loadHistoryByUser: function () {
    var that = this
    var params = {
      otherUserId: this.data.otherUserId,
      size: 20
    }
    if (this.data.cursor) {
      params.cursor = this.data.cursor
      params.lastId = this.data.lastId
    }

    request({
      url: '/api/v1/chat/history',
      method: 'GET',
      data: params
    }).then(function (result) {
      var list = result.messages || []
      var messages = list.map(function (msg) { return mapMessage(msg, that.data.myUid) })
      messages.reverse()

      // 首次加载时，用第一条消息的 conversationId 更新会话ID
      if (!that.data.conversationId && messages.length > 0) {
        var firstMsg = result.messages[0]
        if (firstMsg && firstMsg.conversationId) {
          that.setData({ conversationId: firstMsg.conversationId })
        }
      }

      if (that.data.cursor) {
        var newList = messages.concat(that.data.messages)
        that.setData({
          messages: newList,
          cursor: result.nextCursor || null,
          lastId: result.nextId || null,
          hasMore: result.hasMore !== false,
          loadingMore: false,
          loading: false,
          loadFailed: false
        })
      } else {
        that.setData({
          messages: messages,
          cursor: result.nextCursor || null,
          lastId: result.nextId || null,
          hasMore: result.hasMore !== false,
          loading: false,
          loadFailed: false,
          scrollToView: 'msg-bottom'
        })
        setTimeout(function () { that.scrollToBottom() }, 300)
      }
    }).catch(function (err) {
      console.error('加载聊天历史失败:', err)
      that.setData({
        loading: false,
        loadFailed: true,
        loadingMore: false
      })
    })
  },

  onScrollToUpper: function () {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })
    this.loadHistory()
  },

  connectStomp: function () {
    if (!createStompClient) {
      console.error('[Chat] STOMP 客户端不可用')
      return
    }
    var token = wx.getStorageSync('token')
    if (!token) {
      console.error('[Chat] 未登录，无法连接 WebSocket')
      return
    }
    var that = this
    var wsUrl
    try {
      wsUrl = getBaseUrl().replace(/^http/, 'ws') + '/ws'
    } catch (err) {
      console.error('[Chat] 后端地址未配置:', err)
      wx.showToast({ title: err.message || '后端地址未配置', icon: 'none' })
      return
    }

    this._stompClient = createStompClient({
      url: wsUrl,
      token: token,
      debug: false,
      onConnected: function () {
        console.log('[Chat] STOMP connected')
        var myUid = that.data.myUid
        if (myUid) {
          that._stompSubId = that._stompClient.subscribe(
            '/queue/user/' + myUid,
            function (msg) { that.onReceiveMessage(msg) }
          )
        }
        that.markConversationRead()
      },
      onMessage: function () { },
      onError: function (err) {
        console.error('[Chat] STOMP error:', err)
      }
    })
    this._stompClient.connect()
  },

  onReceiveMessage: function (msg) {
    if (!msg) return

    // 如果消息带有 conversationId，按会话ID过滤
    if (msg.conversationId && this.data.conversationId) {
      if (msg.conversationId !== this.data.conversationId) return
    } else if (this.data.otherUserId) {
      // 回退：按对方用户ID过滤（消息的发件人或收件人匹配）
      var msgSenderId = Number(msg.senderId)
      var msgReceiverId = Number(msg.receiverId)
      var otherId = Number(this.data.otherUserId)
      if (msgSenderId !== otherId && msgReceiverId !== otherId) return
    } else {
      return
    }

    var mapped = mapMessage(msg, this.data.myUid)
    var exists = this.data.messages.some(function (m) { return m._id === mapped._id })
    if (exists) return

    this.setData({
      messages: this.data.messages.concat([mapped]),
      scrollToView: 'msg-bottom'
    })
    this.scrollToBottom()
  },

  onInput: function (e) {
    this.setData({ inputValue: e.detail.value })
  },

  sendMessage: function () {
    var content = this.data.inputValue.trim()
    if (!content) return
    if (!this._stompClient || !this._stompClient.isConnected()) {
      wx.showToast({ title: '连接中，请稍候', icon: 'none' })
      return
    }
    var dest = '/app/chat/' + this.data.otherUserId + '/send'
    var body = {
      receiverId: this.data.otherUserId,
      orderId: this.data.orderId,
      orderType: this.data.orderType,
      msgType: 1,
      content: content
    }
    this._stompClient.send(dest, body)
    this.setData({ inputValue: '' })
  },

  sendImageMessage: function (imageUrl) {
    if (!this._stompClient || !this._stompClient.isConnected()) {
      wx.showToast({ title: '连接中，请稍候', icon: 'none' })
      return
    }
    var dest = '/app/chat/' + this.data.otherUserId + '/send'
    var body = {
      receiverId: this.data.otherUserId,
      orderId: this.data.orderId,
      orderType: this.data.orderType,
      msgType: 2,
      content: imageUrl
    }
    this._stompClient.send(dest, body)
  },

  markConversationRead: function () {
    if (!this.data.otherUserId) return
    var that = this
    request({
      url: '/api/v1/chat/read',
      method: 'POST',
      data: { otherUserId: this.data.otherUserId, orderId: this.data.orderId }
    }).then(function () {
      // 标记已读成功：通过 API 刷新 badge（loadInboxBadge 内部有乐观更新保护）
      var tabBar = getApp().globalData._tabBar
      if (tabBar) {
        tabBar.loadInboxBadge()
      }
    }).catch(function (err) {
      console.error('标记已读失败:', err)
      // 失败时也用本地缓存更新 badge
      var tabBar = getApp().globalData._tabBar
      if (tabBar) tabBar.updateBadgeFromGlobalData()
    })
  },

  togglePanel: function () {
    this.setData({ showPanel: !this.data.showPanel })
  },

  closePanel: function () {
    this.setData({ showPanel: false })
  },

  chooseImage: function () {
    var that = this
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: function (res) {
        that.uploadAndSendImage(res.tempFilePaths[0])
        that.setData({ showPanel: false })
      }
    })
  },

  takePhoto: function () {
    var that = this
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['camera'],
      success: function (res) {
        that.uploadAndSendImage(res.tempFilePaths[0])
        that.setData({ showPanel: false })
      }
    })
  },

  uploadAndSendImage: function (filePath) {
    var token = wx.getStorageSync('token')
    var that = this
    wx.showLoading({ title: '发送中...' })

    wx.uploadFile({
      url: getBaseUrl() + '/api/v1/upload/image',
      filePath: filePath,
      name: 'file',
      header: {
        Authorization: 'Bearer ' + token
      },
      success: function (res) {
        wx.hideLoading()
        try {
          var data = JSON.parse(res.data)
          if (data.code === 200 && data.data) {
            var imageUrl = typeof data.data === 'string' ? data.data : data.data.url
            that.sendImageMessage(imageUrl)
          } else {
            if (!handleAuthFailure(data, token)) {
              wx.showToast({ title: data.message || '上传失败', icon: 'none' })
            }
          }
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      },
      fail: function () {
        wx.hideLoading()
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    })
  },

  previewImage: function (e) {
    var src = e.currentTarget.dataset.src
    wx.previewImage({ urls: [src], current: src })
  },

  scrollToBottom: function () {
    var that = this
    setTimeout(function () {
      that.setData({ scrollToView: 'msg-bottom' })
    }, 200)
  },

  scrollToMessage: function (e) {
    var msgId = e.currentTarget.dataset.msgId
    this.setData({ scrollToView: 'msg-' + msgId })
  },

  /** 查询当前用户是否已关注对方 */
  checkFollowStatus: function () {
    var that = this
    var otherUserId = this.data.otherUserId
    if (!otherUserId) return

    request({
      url: '/api/v1/follow/count/' + otherUserId,
      method: 'GET'
    }).then(function (data) {
      that.setData({ isFollowed: data.followedByMe || false })
    }).catch(function (err) {
      console.error('查询关注状态失败:', err)
    })
  },

  followUser: function () {
    var that = this
    var otherUserId = this.data.otherUserId
    if (!otherUserId) return

    var isFollowed = this.data.isFollowed
    var method = isFollowed ? 'DELETE' : 'POST'

    request({
      url: '/api/v1/follow/' + otherUserId,
      method: method
    }).then(function () {
      that.setData({ isFollowed: !isFollowed })
      wx.showToast({ title: isFollowed ? '已取消关注' : '已关注', icon: 'none' })
    }).catch(function (err) {
      console.error('关注操作失败:', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    })
  },

  openSharedPost: function (e) {
    var postId = e.currentTarget.dataset.postId
    if (!postId) return
    var safeNavigate = require('../../utils/safeNavigate').safeNavigate
    safeNavigate({ url: '/pages/post-detail/post-detail?id=' + postId })
  },

  goBack: function () {
    wx.navigateBack()
  }
})

function mapMessage(vo, myUid) {
  var isMe = String(vo.senderId) === String(myUid)

  // msgType=4 帖子分享 → 解析 JSON 渲染为链接卡片
  if (vo.msgType === 4) {
    var linkData = parseShareJson(vo.content)
    if (linkData) {
      return {
        _id: vo.id,
        id: vo.id,
        from: isMe ? 'me' : 'other',
        type: 'link',
        content: linkData.title || '帖子分享',
        linkTitle: linkData.title || '',
        linkDesc: linkData.desc || '',
        linkCoverImage: linkData.coverImage || '',
        linkPostId: linkData.postId,
        linkSharerName: linkData.sharerName || '',
        senderId: String(vo.senderId),
        senderNickname: vo.senderNickname || '',
        time: formatChatTime(vo.createdAt),
        timestamp: vo.createdAt ? new Date(vo.createdAt.replace(' ', 'T')).getTime() : 0
      }
    }
    // JSON 解析失败，降级为文本
    return {
      _id: vo.id,
      id: vo.id,
      from: isMe ? 'me' : 'other',
      type: 'text',
      content: '[帖子分享]',
      senderId: String(vo.senderId),
      senderNickname: vo.senderNickname || '',
      time: formatChatTime(vo.createdAt),
      timestamp: vo.createdAt ? new Date(vo.createdAt.replace(' ', 'T')).getTime() : 0
    }
  }

  return {
    _id: vo.id,
    id: vo.id,
    from: isMe ? 'me' : 'other',
    type: vo.msgType === 2 ? 'image' : (vo.msgType === 3 ? 'system' : 'text'),
    content: vo.msgType === 3 ? '消息已撤回' : (vo.content || ''),
    senderId: String(vo.senderId),
    senderNickname: vo.senderNickname || '',
    time: formatChatTime(vo.createdAt),
    timestamp: vo.createdAt ? new Date(vo.createdAt.replace(' ', 'T')).getTime() : 0
  }
}

/** 解析帖子分享 JSON，失败返回 null */
function parseShareJson(content) {
  if (!content) return null
  try {
    var data = JSON.parse(content)
    if (data.postId) return data
    return null
  } catch (e) {
    return null
  }
}

function formatChatTime(isoStr) {
  if (!isoStr) return ''
  var date = new Date(isoStr.replace(' ', 'T'))
  if (isNaN(date.getTime())) return isoStr
  var h = date.getHours().toString()
  if (h.length < 2) h = '0' + h
  var m = date.getMinutes().toString()
  if (m.length < 2) m = '0' + m
  return h + ':' + m
}
