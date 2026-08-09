var requestModule = require('../../utils/request')
var request = requestModule.request

Page({
  data: {
    shareUsers: [],
    shareActions: [
      { id: 1, name: '微信好友', icon: '💬' },
      { id: 2, name: '朋友圈', icon: '🔄' },
      { id: 3, name: '生成海报', icon: '🖼' },
      { id: 4, name: '复制链接', icon: '🔗' }
    ],
    targetId: null,
    targetType: 'post',  // 'post' | 'idle'
    loading: true,
    loadFailed: false
  },

  onLoad(options) {
    // 兼容旧版 postId 参数和新的 targetId + targetType 参数
    var targetId = (options && options.targetId) ? Number(options.targetId) : null
    var postId = (options && options.postId) ? Number(options.postId) : null
    var targetType = (options && options.targetType) ? options.targetType : 'post'

    var finalTargetId = targetId || postId
    this.setData({
      targetId: finalTargetId,
      targetType: targetType
    })

    if (finalTargetId) {
      this.loadMutualFriends()
    } else {
      this.setData({ loading: false, loadFailed: true })
    }
  },

  /** 加载互关好友列表 */
  loadMutualFriends() {
    var that = this
    request({
      url: '/api/v1/follow/mutual',
      method: 'GET',
      data: { limit: 50 }
    }).then(function (data) {
      var friends = (data || []).map(function (f) {
        return {
          id: f.userId,
          name: f.nickname || '用户',
          avatar: f.avatar || ''
        }
      })
      that.setData({
        shareUsers: friends,
        loading: false
      })
    }).catch(function (err) {
      console.error('加载互关好友失败:', err)
      that.setData({ loading: false, loadFailed: true })
    })
  },

  /** 分享内容给指定好友 */
  shareToUser(e) {
    var userId = e.currentTarget.dataset.userId
    var targetId = this.data.targetId
    var targetType = this.data.targetType
    if (!userId || !targetId) return

    var that = this
    wx.showLoading({ title: '分享中...' })

    // 根据类型使用不同的 API
    var url
    if (targetType === 'idle') {
      url = '/api/v1/idle/product/' + targetId + '/share/' + userId
    } else {
      url = '/api/post/' + targetId + '/share/' + userId
    }

    request({
      url: url,
      method: 'POST'
    }).then(function () {
      wx.hideLoading()
      wx.showToast({ title: '已分享', icon: 'success' })
      setTimeout(function () { wx.navigateBack() }, 1500)
    }).catch(function (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '分享失败', icon: 'none' })
    })
  },

  /** 分享到其他平台 */
  onShareAction(e) {
    var name = e.currentTarget.dataset.name
    var targetId = this.data.targetId
    var targetType = this.data.targetType

    if (name === '复制链接') {
      var path
      if (targetType === 'idle') {
        path = '/pages/market-detail/market-detail?id=' + targetId
      } else {
        path = '/pages/post-detail/post-detail?id=' + targetId
      }
      wx.setClipboardData({
        data: path,
        success: function () {
          wx.showToast({ title: '链接已复制', icon: 'success' })
        },
        fail: function () {
          wx.showToast({ title: '复制失败', icon: 'none' })
        }
      })
    } else {
      wx.showToast({ title: name + '功能开发中', icon: 'none' })
    }
  },

  onCancel() {
    wx.navigateBack()
  }
})
