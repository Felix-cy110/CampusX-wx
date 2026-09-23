Page({
  onLoad(options) {
    // 帖子、闲置和跑腿发布后都会进入此页，返回缓存中的首页时需重新取列表。
    if (['post', 'errand', 'supply'].includes(options.from)) {
      getApp().globalData.homeContentNeedsRefresh = true
    }
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({
      statusBarHeight,
      navBarHeight,
      from: options.from || ''
    })
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    from: ''
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  finish() {
    if (this.data.from === 'rating') {
      wx.redirectTo({ url: '/pages/publish-rating/publish-rating' })
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  }
})
