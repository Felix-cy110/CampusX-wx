const mock = require('../../utils/mock.js')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    menuItems: [
      { id: 1, name: '联系客服', icon: '/images/SVG/kefu.svg', arrow: true },
      { id: 2, name: '跨校发帖付费额度充值', icon: '/images/SVG/fufei.svg', arrow: true },
      { id: 3, name: '修改学校申诉', icon: '/images/SVG/xiugai.svg', arrow: true },
      { id: 4, name: '退出学校', icon: '/images/SVG/xuexiao_xuexiaoxinxi.svg', arrow: true },
      { id: 5, name: '退出登录', icon: '/images/SVG/dengchu.svg', arrow: false, danger: true }
    ],
    version: 'V1.0.0'
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })
  },

  onBack() { wx.navigateBack() },

  onMenuTap(e) {
    const { id, name } = e.currentTarget.dataset
    if (name === '联系客服') {
      wx.showToast({ title: '正在联系客服...', icon: 'none' })
    } else if (name === '跨校发帖付费额度充值') {
      safeNavigate({ url: '/pages/recharge/recharge' })
    } else if (name === '修改学校申诉') {
      safeNavigate({ url: '/pages/school-appeal/school-appeal' })
    } else if (name === '退出学校') {
      safeNavigate({ url: '/pages/exit-school/exit-school' })
    } else if (name === '退出登录') {
      wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            const app = getApp()
            app.globalData.userInfo = null
            wx.reLaunch({ url: '/pages/login/login' })
          }
        }
      })
    }
  }
})
