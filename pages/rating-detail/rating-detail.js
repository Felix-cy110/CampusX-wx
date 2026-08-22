const mock = require('../../utils/mock.js')

function buildShareTitle(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return '分享一个校园评分'
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}

Page({
  data: {
    rating: {},
    comments: [],
    ratingId: '',
    isLiked: false,
    isFavorited: false,
    starArray: [1, 2, 3, 4, 5],
    statusBarHeight: 0,
    navBarHeight: 0,
    capsuleGap: 0
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    // 右上角「更多」按钮按胶囊真实坐标动态避让，适配所有机型
    const capsuleGap = systemInfo.windowWidth - menuButton.left + 8
    this.setData({ statusBarHeight, navBarHeight, capsuleGap })
    const id = parseInt(options.id) || 301
    const rating = mock.ratings.find(r => r.id === id) || mock.ratings[0]
    rating.totalRaters = '3248'
    rating.isLiked = false
    this.setData({
      rating,
      ratingId: id,
      starArray: this.getStarArray(rating.score || 0),
      comments: [
        {
          id: 1, name: '蔡俊', avatar: '/images/avatars/蔡俊.png', time: '58秒',
          content: '真的很好吃，下次还去',
          likes: 15, liked: false,
          replies: [
            { id: 11, name: '李明', avatar: '/images/avatars/李明.png', time: '30秒', content: '我也是常客了', replyTo: '蔡俊' }
          ]
        },
        {
          id: 2, name: '王芳', avatar: '/images/avatars/王芳.png', time: '8分钟',
          content: '中辣正好，微辣没味道',
          likes: 8, liked: false,
          replies: []
        }
      ]
    })
  },

  onShareAppMessage() {
    const rating = this.data.rating || {}
    const shareConfig = {
      title: buildShareTitle(rating.title),
      path: '/pages/rating-detail/rating-detail?id=' + encodeURIComponent(this.data.ratingId)
    }
    if (rating.images && rating.images[0]) shareConfig.imageUrl = rating.images[0]
    return shareConfig
  },

  getStarArray(score) {
    const fullStars = Math.floor(score)
    const hasHalf = score - fullStars >= 0.25
    const result = []
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        result.push('full')
      } else if (i === fullStars && hasHalf) {
        result.push('half')
      } else {
        result.push('empty')
      }
    }
    return result
  },

  goBack() {
    wx.navigateBack()
  },

  toggleLike() {
    const rating = this.data.rating
    rating.isLiked = !rating.isLiked
    rating.stats.likes += rating.isLiked ? 1 : -1
    this.setData({ rating })
    wx.showToast({
      title: rating.isLiked ? '已点赞' : '已取消点赞',
      icon: 'none'
    })
  },

  toggleFavorite() {
    const isFavorited = !this.data.isFavorited
    this.setData({ isFavorited })
    wx.showToast({
      title: isFavorited ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
  },

  showMoreOptions() {
    wx.showActionSheet({
      itemList: ['举报帖子']
    })
  },

  goToUserProfile(e) {
    const { name, avatar } = e.currentTarget.dataset
    wx.setStorageSync('selectedUser', { name, avatar })
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id
    const comments = this.data.comments.map(c => {
      if (c.id === commentId) {
        c.liked = !c.liked
        c.likes += c.liked ? 1 : -1
      }
      return c
    })
    this.setData({ comments })
  },

  replyComment(e) {
    const commentId = e.currentTarget.dataset.id
    wx.showToast({ title: '回复评论 ' + commentId, icon: 'none' })
  },

  addComment() {
    wx.showToast({ title: '打开评论输入', icon: 'none' })
  }
})
