const app = getApp()

Page({
  data: {
    amount: 0,
    quota: 5
  },

  onLoad(options) {
    const amount = parseInt(options.amount) || 0
    const quota = parseInt(options.quota) || 5
    this.setData({ amount: amount, quota: quota })
  },

  onFinish() {
    wx.navigateBack({
      delta: 1
    })
  }
})
