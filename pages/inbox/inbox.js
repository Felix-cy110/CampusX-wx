const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')
const { canAccessCampusFeatures } = require('../../utils/auth')

const SWIPE_THRESHOLD = 80
const REFRESH_THRESHOLD = 80

Page({
  data: {
    isJoinedSchool: true,
    notifications: {
      likes: { count: 0 },
      followers: { count: 0 },
      comments: { count: 0 },
      system: { count: 0 }
    },
    conversations: [],
    chatTab: 'friend',
    filteredConversations: [],
    statusBarHeight: 0,
    navBarHeight: 0,

    // swipe state
    swipeIndex: -1,
    swipeOffset: 0,

    // pull-to-refresh
    refreshing: false,
    refreshText: '下拉刷新',

    // scroll-to-top
    showScrollTop: false,
    _scrollTop: 0,

    // skeleton loading
    loading: true,

    // drag state for transition control
    isDragging: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    this.setData({
      isJoinedSchool: app.globalData.isJoinedSchool,
      statusBarHeight,
      navBarHeight
    })
    this.loadData()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    // 从子页面返回时，立即从本地缓存同步通知数量和 tabBar badge（零延迟）
    if (this._initialized) {
      this.syncNotificationsFromCache()
    }
    if (!canAccessCampusFeatures()) {
      this.setData({ conversations: [], filteredConversations: [], loading: false })
      this._initialized = true
      return
    }
    // 再异步刷新（后台静默更新，保护本地已清零数据不被过期 API 覆盖）
    this.loadNotificationCounts()
    // 首次显示由 onLoad → loadData 处理，后续显示（如从聊天页返回）刷新会话列表
    if (this._initialized) {
      this.loadConversations()
    }
    this._initialized = true
  },

  /** 加载所有数据 */
  loadData() {
    if (!canAccessCampusFeatures()) {
      this.setData({ conversations: [], filteredConversations: [], loading: false })
      return Promise.resolve()
    }
    this.setData({ loading: true })
    this.loadNotificationCounts()
    this.loadConversations()
  },

  /** 获取收件箱通知数量，并同步到全局缓存（尊重乐观更新，防止过期 API 数据覆盖本地已清零计数） */
  loadNotificationCounts() {
    if (!canAccessCampusFeatures()) return Promise.resolve()
    const that = this
    return request({ url: '/api/v1/notification/count' }).then(data => {
      // 使用实时 globalData（非快照），防止并发请求中较旧回调覆盖子页面刚做的乐观更新
      const app = getApp()
      const localCounts = app.globalData.notificationCounts
      const readSent = app.globalData._notificationReadSent || {}
      const pendingChat = app.globalData._pendingChatDecrement || 0

      // 对于通知类型：如果本地已标记已读（值为0且已发送API），不接受 API 返回的更大值
      const mergeLikes = readSent.likes && localCounts.likes === 0 && (data.likes || 0) > 0
        ? 0 : (data.likes || 0)
      const mergeFollowers = readSent.followers && localCounts.followers === 0 && (data.followers || 0) > 0
        ? 0 : (data.followers || 0)
      const mergeComments = readSent.comments && localCounts.comments === 0 && (data.comments || 0) > 0
        ? 0 : (data.comments || 0)
      const mergeSystem = readSent.system && localCounts.system === 0 && (data.system || 0) > 0
        ? 0 : (data.system || 0)

      // 当 API 返回值已确认归零，清除乐观标记
      if (readSent.likes && (data.likes || 0) === 0) app.globalData._notificationReadSent.likes = false
      if (readSent.followers && (data.followers || 0) === 0) app.globalData._notificationReadSent.followers = false
      if (readSent.comments && (data.comments || 0) === 0) app.globalData._notificationReadSent.comments = false
      if (readSent.system && (data.system || 0) === 0) app.globalData._notificationReadSent.system = false

      // 对于聊天未读：用 pendingChat 调整 API 返回值，防止 API 未及时更新时覆盖本地已扣除的值
      const apiChat = data.chatUnread || 0
      let mergeChat
      if (apiChat <= localCounts.chatUnread) {
        // API 返回值已确认本地扣除 → 清除 pending，直接使用 API 值
        app.globalData._pendingChatDecrement = 0
        mergeChat = apiChat
      } else {
        // API 返回值可能过期 → 减去待确认扣除量
        mergeChat = Math.max(0, apiChat - pendingChat)
      }

      // 同步到全局缓存
      app.globalData.notificationCounts = {
        likes: mergeLikes,
        followers: mergeFollowers,
        comments: mergeComments,
        system: mergeSystem,
        chatUnread: mergeChat
      }
      app.globalData._notificationCountsLoaded = true

      that.setData({
        notifications: {
          likes: { count: mergeLikes },
          followers: { count: mergeFollowers },
          comments: { count: mergeComments },
          system: { count: mergeSystem }
        }
      })
    }).catch(() => {
      // 请求失败时保持现有数据
    })
  },

  /** 获取会话列表（调用后端 API） */
  loadConversations() {
    if (!canAccessCampusFeatures()) {
      this.setData({ conversations: [], filteredConversations: [], loading: false })
      return Promise.resolve()
    }
    const that = this
    return request({
      url: '/api/v1/chat/conversations',
      method: 'GET',
      data: { page: 1, size: 50 }
    }).then(function (data) {
      const conversations = (data || []).map(mapConversation)
      that.setData({
        conversations,
        loading: false
      }, function () { that.filterConversations() })
    }).catch(function (err) {
      console.error('加载会话列表失败:', err)
      that.setData({ loading: false })
    })
  },

  /** 切换子 tab（互关/临时会话） */
  switchChatTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.chatTab) return
    this.setData({ chatTab: tab, swipeIndex: -1, swipeOffset: 0 })
    this.filterConversations()
  },

  filterConversations() {
    const tab = this.data.chatTab
    const filtered = this.data.conversations.filter(c =>
      tab === 'friend' ? c.type === 'friend' : c.type === 'temp'
    )
    this.setData({ filteredConversations: filtered })
  },

  /** 进入聊天 */
  goToChat(e) {
    const { convId, userId, name, avatar, orderId, orderType, unread } = e.currentTarget.dataset
    const unreadCount = parseInt(unread) || 0

    // 1. 立即标记该会话为已读（乐观更新）
    if (unreadCount > 0) {
      const convs = this.data.conversations.map(c => {
        if (c.conversationId === convId || c.id === convId) {
          return { ...c, unread: 0 }
        }
        return c
      })
      this.setData({ conversations: convs }, () => { this.filterConversations() })

      // 2. 从全局通知计数中减去该会话的未读数
      const app = getApp()
      const counts = app.globalData.notificationCounts
      counts.chatUnread = Math.max(0, (counts.chatUnread || 0) - unreadCount)
      // 记录待确认的扣除量，防止 loadNotificationCounts 用过期 API 数据覆盖
      app.globalData._pendingChatDecrement = (app.globalData._pendingChatDecrement || 0) + unreadCount
      // 5秒超时兜底：清除 pending（此时后端应已处理标记已读请求）
      if (app.globalData._pendingChatTimer) clearTimeout(app.globalData._pendingChatTimer)
      app.globalData._pendingChatTimer = setTimeout(() => {
        app.globalData._pendingChatDecrement = 0
      }, 5000)

      // 3. 立即刷新 tabBar badge
      const tabBar = app.globalData._tabBar
      if (tabBar) tabBar.updateBadgeFromGlobalData()
    }

    safeNavigate({
      url: `/pages/chat/chat?convId=${convId}&userId=${userId}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}&orderId=${orderId || ''}&orderType=${orderType || ''}&unread=${unreadCount}`
    })
  },

  /* ========== 滑动删除 ========== */

  onTouchStart(e) {
    if (this.data.swipeIndex !== -1) {
      this.closeSwipe()
    }
    const touch = e.touches[0]
    this._touchStartX = touch.clientX
    this._touchStartY = touch.clientY
    this._touchStartTime = Date.now()
    this._swipingItem = e.currentTarget.dataset.index
    this.setData({ isDragging: true })
  },

  onTouchMove(e) {
    if (this._swipingItem === undefined) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - this._touchStartX
    const deltaY = touch.clientY - this._touchStartY

    // 垂直滚动时不触发滑动
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    // 仅允许向左滑动
    const offset = Math.max(Math.min(deltaX, 0), -180)
    this.setData({ swipeOffset: offset })
  },

  onTouchEnd() {
    if (this._swipingItem === undefined) return
    const offset = this.data.swipeOffset

    if (offset < -SWIPE_THRESHOLD) {
      this.setData({
        swipeIndex: this._swipingItem,
        swipeOffset: -180,
        isDragging: false
      })
    } else {
      this.setData({
        swipeIndex: -1,
        swipeOffset: 0,
        isDragging: false
      })
    }

    this._touchStartX = 0
    this._touchStartY = 0
    this._touchStartTime = 0
    this._swipingItem = undefined
  },

  closeSwipe() {
    this.setData({ swipeIndex: -1, swipeOffset: 0, isDragging: false })
  },

  /** 删除会话 */
  deleteConversation(e) {
    const index = e.currentTarget.dataset.index
    const conv = this.data.filteredConversations[index]
    if (!conv) return

    wx.showModal({
      title: '确认删除',
      content: `确定删除与「${conv.name}」的会话吗？`,
      success: (res) => {
        if (res.confirm) {
          const conversations = this.data.conversations.filter(c => c.id !== conv.id)
          this.setData({ conversations, swipeIndex: -1, swipeOffset: 0 }, () => {
            this.filterConversations()
            // 如果删除的会话有未读消息，同步扣减全局计数
            if (conv.unread > 0) {
              const app = getApp()
              const counts = app.globalData.notificationCounts
              counts.chatUnread = Math.max(0, (counts.chatUnread || 0) - conv.unread)
              const tabBar = app.globalData._tabBar
              if (tabBar) tabBar.updateBadgeFromGlobalData()
            }
            wx.showToast({ title: '已删除', icon: 'none' })
          })
        }
      }
    })
  },

  /* ========== 下拉刷新 ========== */

  onRefresh() {
    this.setData({ refreshing: true, refreshText: '刷新中...' })
    setTimeout(() => {
      this.loadData()
      this.setData({ refreshing: false, refreshText: '下拉刷新' })
      wx.showToast({ title: '已刷新', icon: 'none' })
    }, 600)
  },

  onPulling(e) {
    const dy = e.detail.dy || 0
    if (dy > REFRESH_THRESHOLD) {
      this.setData({ refreshText: '释放刷新' })
    } else {
      this.setData({ refreshText: '下拉刷新' })
    }
  },

  /* ========== 滚动检测 ========== */

  onScroll(e) {
    const scrollTop = e.detail.scrollTop
    this.setData({ showScrollTop: scrollTop > 300 })
  },

  scrollToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    this.setData({ _scrollTop: 0 })
  },

  /* ========== 导航栏操作 ========== */

  onMoreTap() {
    wx.showActionSheet({
      itemList: ['全部已读', '清空会话'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.markAllRead()
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '清空会话',
            content: '确定清空所有会话吗？此操作不可撤销。',
            success: (r) => {
              if (r.confirm) {
                this.setData({ conversations: [], filteredConversations: [] })
                wx.showToast({ title: '已清空', icon: 'none' })
              }
            }
          })
        }
      }
    })
  },

  markAllRead() {
    const that = this
    // 收集所有有未读消息的会话
    const unreadConvs = this.data.conversations.filter(c => c.unread > 0)
    if (unreadConvs.length === 0) {
      wx.showToast({ title: '没有未读消息', icon: 'none' })
      return
    }
    // 并发标记所有会话已读
    const promises = unreadConvs.map(function (conv) {
      return request({
        url: '/api/v1/chat/read',
        method: 'POST',
        data: { otherUserId: conv.otherUserId, orderId: conv.orderId }
      }).catch(function () { /* 单个失败不影响整体 */ })
    })
    Promise.all(promises).then(function () {
      const conversations = that.data.conversations.map(function (c) { return { ...c, unread: 0 } })
      that.setData({ conversations }, function () {
        that.filterConversations()
        // 同步清零全局聊天未读计数
        const app = getApp()
        app.globalData.notificationCounts.chatUnread = 0
        app.globalData._pendingChatDecrement = 0
        const tabBar = app.globalData._tabBar
        if (tabBar) tabBar.updateBadgeFromGlobalData()
        wx.showToast({ title: '已全部已读', icon: 'none' })
      })
    }).catch(function () {
      // 即使部分失败也更新本地状态
      const conversations = that.data.conversations.map(function (c) { return { ...c, unread: 0 } })
      that.setData({ conversations }, function () {
        that.filterConversations()
        const app = getApp()
        app.globalData.notificationCounts.chatUnread = 0
        app.globalData._pendingChatDecrement = 0
        const tabBar = app.globalData._tabBar
        if (tabBar) tabBar.updateBadgeFromGlobalData()
        wx.showToast({ title: '已全部已读', icon: 'none' })
      })
    })
  },

  onSettingsTap() {
    wx.showToast({ title: '设置', icon: 'none' })
  },

  /** 从 globalData 缓存立即同步通知数量到页面（零延迟，不等 API） */
  syncNotificationsFromCache() {
    const app = getApp()
    // 仅在 globalData 已被 API 填充过时才同步（防止首次加载用初始零值覆盖正确数据）
    if (!app.globalData._notificationCountsLoaded) return
    const counts = app.globalData.notificationCounts || {}
    this.setData({
      notifications: {
        likes: { count: counts.likes || 0 },
        followers: { count: counts.followers || 0 },
        comments: { count: counts.comments || 0 },
        system: { count: counts.system || 0 }
      }
    })
    // 同时立即刷新 tabBar badge
    const tabBar = app.globalData._tabBar
    if (tabBar) tabBar.updateBadgeFromGlobalData()
  },

  /** 通知分类入口跳转（子页面 onLoad 会做乐观更新清零对应计数） */
  goToLiked() {
    safeNavigate({ url: '/pages/liked/liked' })
  },
  goToFollowers() {
    safeNavigate({ url: '/pages/followers/followers' })
  },
  goToComments() {
    safeNavigate({ url: '/pages/comments/comments' })
  },
  goToSystemMsg() {
    safeNavigate({ url: '/pages/system-msg/system-msg' })
  }
})

/**
 * 将后端 ConversationVO 映射为 UI 所需格式
 * 互关（friend）= orderId 为空，临时会话（temp）= orderId 非空
 */
function mapConversation(vo) {
  return {
    id: vo.conversationId,
    conversationId: vo.conversationId,
    otherUserId: vo.otherUserId,
    name: vo.otherNickname || '未知用户',
    avatar: vo.otherAvatarUrl ? toFullUrl(vo.otherAvatarUrl) : '/images/avatars/default.png',
    lastMsg: formatLastMessage(vo.lastMessage, vo.lastMsgType),
    time: formatConvTime(vo.lastMsgTime),
    unread: vo.unreadCount || 0,
    orderId: vo.orderId || null,
    orderType: vo.orderType || null,
    type: vo.orderId ? 'temp' : 'friend'
  }
}

/**
 * 格式化最后一条消息预览
 * 消息类型：1-文字 2-图片 3-撤回
 */
function formatLastMessage(msg, msgType) {
  if (msgType === 3) return '消息已撤回'
  if (msgType === 2) return '[图片]'
  if (msgType === 4) {
    try {
      var data = JSON.parse(msg || '{}')
      if (data.title) {
        return data.title
      }
    } catch (e) {
      // 解析失败，可能是后端截断导致的残缺 JSON，继续尝试正则提取
    }
    var match = ('' + msg).match(/"title"\s*:\s*"([^"]*)"/)
    if (!match) {
      match = ('' + msg).match(/"title"\s*:\s*"([^"]*)/)
    }
    if (match && match[1]) {
      return match[1]
    }
    return '分享了一条帖子'
  }
  return msg || ''
}

/**
 * 格式化会话时间
 * 今天显示 HH:mm，昨天/前天显示对应文字，超过后显示天数/月
 */
function formatConvTime(isoStr) {
  if (!isoStr) return ''
  var date = new Date(isoStr.replace(' ', 'T'))
  if (isNaN(date.getTime())) return isoStr

  var now = new Date()
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  var target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  var diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    var h = date.getHours()
    var hours = h < 10 ? '0' + h : '' + h
    var m = date.getMinutes()
    var minutes = m < 10 ? '0' + m : '' + m
    return hours + ':' + minutes
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays === 2) {
    return '前天'
  } else if (diffDays < 30) {
    return diffDays + '天'
  } else {
    return Math.floor(diffDays / 30) + '个月'
  }
}
