const mock = require('../../utils/mock.js')

Page({
  data: {
    team: {},
    comments: [],
    teamId: '',
    isLiked: false,
    isFavorited: false,
    hasJoined: false,
    isFollowed: false
  },

  onLoad(options) {
    const id = parseInt(options.id) || 201
    const team = mock.teams.find(t => t.id === id) || mock.teams[0]
    team.reward = 15
    team.isLiked = false
    this.setData({
      team,
      teamId: id,
      comments: [
        {
          id: 1, name: '蔡俊', avatar: '/images/avatars/蔡俊.png', time: '58秒',
          content: '还有位置吗？我想参加',
          likes: 5, liked: false,
          replies: [
            { id: 11, name: '陈雪', avatar: '/images/avatars/陈雪.png', time: '30秒', content: '还有一个位置，快来', replyTo: '蔡俊' }
          ]
        },
        {
          id: 2, name: '黎小新', avatar: '/images/avatars/黎小新.png', time: '5分钟',
          content: '已经加入了，期待周末的拼车',
          likes: 3, liked: false,
          replies: []
        }
      ]
    })
  },

  goBack() {
    wx.navigateBack()
  },

  toggleLike() {
    const team = this.data.team
    team.isLiked = !team.isLiked
    team.stats.likes += team.isLiked ? 1 : -1
    this.setData({ team })
    wx.showToast({
      title: team.isLiked ? '已点赞' : '已取消点赞',
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

  joinTeam() {
    if (this.data.hasJoined) {
      wx.showToast({
        title: '你已经加入该队伍了',
        icon: 'none'
      })
      return
    }
    this.setData({ hasJoined: true })
    wx.showToast({
      title: '加入成功，等待队长确认',
      icon: 'none'
    })
  },

  showMoreOptions() {
    wx.showActionSheet({
      itemList: ['举报帖子', '分享给好友', '分享到微信']
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
  },

  toggleFollow() {
    const isFollowed = !this.data.isFollowed
    this.setData({ isFollowed })
    wx.showToast({ title: isFollowed ? '已关注' : '已取消关注', icon: 'none' })
  }
})
