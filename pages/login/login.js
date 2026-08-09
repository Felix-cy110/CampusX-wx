const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { resetAuthNavigation } = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0
  },
  onLoad() {
    resetAuthNavigation()
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
  },
  wechatLogin() {
    safeNavigate({ url: '/pages/wechat-auth/wechat-auth' })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
