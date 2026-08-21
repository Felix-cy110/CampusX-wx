var markNotificationRead = require('../../utils/unread').markNotificationRead

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
    markNotificationRead('system').catch(function (err) {
      console.error('标记系统消息已读失败:', err)
    })
  }
})
