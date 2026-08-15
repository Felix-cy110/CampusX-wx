// 兼容旧版本可能保留的页面路径；真实登录统一由登录页发起。
Page({
  onLoad() {
    wx.redirectTo({ url: '/pages/login/login' })
  }
})
