const mock = require('../../utils/mock.js')

Page({
  data: {
    shareUsers: [
      { id: 1, name: '刘小翔', avatar: '' },
      { id: 2, name: '谢熙', avatar: '' },
      { id: 3, name: '冯若杰', avatar: '' }
    ],
    shareActions: [
      { id: 1, name: '微信好友', icon: '💬' },
      { id: 2, name: '朋友圈', icon: '🔄' },
      { id: 3, name: '生成海报', icon: '🖼' },
      { id: 4, name: '复制链接', icon: '🔗' }
    ]
  },

  onLoad() {},

  shareToUser(e) {
    const { name } = e.currentTarget.dataset
    wx.showToast({
      title: `已分享给${name}`,
      icon: 'success'
    })
  },

  onShareAction(e) {
    const { name } = e.currentTarget.dataset
    wx.showToast({
      title: name,
      icon: 'none'
    })
  },

  onCancel() {
    wx.navigateBack()
  }
})
