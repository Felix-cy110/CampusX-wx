var requestModule = require('../../utils/request')
var request = requestModule.request
var toFullUrl = requestModule.toFullUrl

function buildShareTitle(value, fallback) {
  var text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}

Page({
  data: {
    shareUsers: [],
    targetId: null,
    targetType: 'post',  // 'post' | 'idle' | 'proxy_demand' | 'proxy_supply'
    shareTitle: '',
    shareImageUrl: '',
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
      this.loadShareTarget()
    } else {
      this.setData({ loading: false, loadFailed: true })
    }
  },

  loadShareTarget() {
    var targetId = this.data.targetId
    var targetType = this.data.targetType
    var task
    if (targetType === 'idle') {
      task = request({
        url: '/api/v1/idle/product/book/' + targetId,
        method: 'GET'
      }).catch(function () {
        return request({
          url: '/api/v1/idle/product/item/' + targetId,
          method: 'GET'
        })
      }).then(function (vo) {
        return {
          title: vo.title || '',
          imageUrl: (vo.imageUrls && vo.imageUrls[0]) || vo.coverImage || ''
        }
      })
    } else if (targetType === 'proxy_demand' || targetType === 'proxy_supply') {
      var isSupply = targetType === 'proxy_supply'
      task = request({
        url: isSupply
          ? '/api/v1/proxy-class-supply/' + targetId
          : '/api/v1/proxy-class-demand/' + targetId,
        method: 'GET'
      }).then(function (vo) {
        return {
          title: isSupply ? vo.subjectRange : vo.courseName,
          imageUrl: ''
        }
      })
    } else {
      task = request({ url: '/api/post/' + targetId, method: 'GET' }).then(function (vo) {
        return {
          title: vo.title || vo.content || '',
          imageUrl: vo.imageUrls && vo.imageUrls[0]
        }
      })
    }

    task.then(data => {
      this.setData({
        shareTitle: data.title || '',
        shareImageUrl: toFullUrl(data.imageUrl)
      })
    }).catch(function (err) {
      console.warn('加载分享卡片信息失败:', err)
    })
  },

  getSharePath() {
    if (this.data.targetType === 'idle') {
      return '/pages/market-detail/market-detail?id=' + encodeURIComponent(this.data.targetId)
    }
    if (this.data.targetType === 'proxy_demand' || this.data.targetType === 'proxy_supply') {
      return '/pages/errand-detail/errand-detail?id=' + encodeURIComponent(this.data.targetId) +
        '&type=' + (this.data.targetType === 'proxy_supply' ? 'supply' : 'demand')
    }
    return '/pages/post-detail/post-detail?id=' + encodeURIComponent(this.data.targetId)
  },

  onShareAppMessage() {
    var isProxy = this.data.targetType === 'proxy_demand' || this.data.targetType === 'proxy_supply'
    var shareConfig = {
      title: buildShareTitle(
        this.data.shareTitle,
        this.data.targetType === 'idle'
          ? '分享一个校园好物'
          : (isProxy ? '分享一个代课信息' : '分享一条校园动态')
      ),
      path: this.getSharePath()
    }
    if (this.data.shareImageUrl) shareConfig.imageUrl = this.data.shareImageUrl
    return shareConfig
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

    if (targetType !== 'post' && targetType !== 'idle') {
      wx.showToast({ title: '该内容暂不支持站内转发', icon: 'none' })
      return
    }

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

  onCancel() {
    wx.navigateBack()
  }
})
