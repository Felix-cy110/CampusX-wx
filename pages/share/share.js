var requestModule = require('../../utils/request')
var request = requestModule.request
var BASE_URL = requestModule.BASE_URL

Page({
  data: {
    shareUsers: [],
    shareActions: [
      { id: 1, name: '微信好友', icon: '💬' },
      { id: 2, name: '朋友圈', icon: '🔄' },
      { id: 3, name: '生成海报', icon: '🖼' },
      { id: 4, name: '复制链接', icon: '🔗' }
    ],
    postId: null,
    loading: true,
    loadFailed: false
  },

  onLoad(options) {
    var postId = (options && options.postId) ? Number(options.postId) : null
    this.setData({ postId: postId })

    if (postId) {
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

  /** 分享帖子给指定好友 */
  shareToUser(e) {
    var userId = e.currentTarget.dataset.userId
    var postId = this.data.postId
    if (!userId || !postId) return

    var that = this
    wx.showLoading({ title: '分享中...' })

    request({
      url: '/api/post/' + postId + '/share/' + userId,
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
    var postId = this.data.postId

    if (name === '复制链接') {
      var path = '/pages/post-detail/post-detail?id=' + postId
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
