var requestModule = require('../../utils/request')
var request = requestModule.request

Page({
  data: {
    messages: [],
    statusBarHeight: 0,
    navBarHeight: 0,

    // detail overlay
    showDetail: false,
    detail: null,
    detailAnim: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
    // 标记系统消息已读
    this.markSystemRead()
  },

  showDetail(e) {
    const id = e.currentTarget.dataset.id
    const msg = this.data.messages.find(m => m.id === id)
    if (!msg) return

    // 标记已读
    const messages = this.data.messages.map(m =>
      m.id === id ? { ...m, unread: false } : m
    )
    this.setData({
      messages,
      detail: msg,
      showDetail: true
    })

    // 触发 slide-in 动画
    setTimeout(() => {
      this.setData({ detailAnim: true })
    }, 30)
  },

  hideDetail() {
    this.setData({ detailAnim: false })
    setTimeout(() => {
      this.setData({ showDetail: false, detail: null })
    }, 280)
  },

  navigateBack() {
    wx.navigateBack()
  },

  /** 标记系统消息为已读，并立即刷新 tabBar badge */
  markSystemRead() {
    var app = getApp()
    app.globalData.notificationCounts.system = 0
    app.globalData._notificationReadSent.system = true
    var tabBar = app.globalData._tabBar
    if (tabBar) tabBar.updateBadgeFromGlobalData()
    request({ url: '/api/v1/notification/read/system', method: 'POST' }).catch(() => {})
    // 30秒安全兜底清除乐观标记（正常流程由 count API 确认归零后清除）
    if (app.globalData._systemReadTimer) clearTimeout(app.globalData._systemReadTimer)
    app.globalData._systemReadTimer = setTimeout(function () {
      app.globalData._notificationReadSent.system = false
    }, 30000)
  }
})
