const { getActivityDetail, getMyTickets } = require('../../utils/api/lottery')
const app = getApp()

const SOURCE_LABEL = { 1: '付费发帖', 2: '交易达标', 3: '邀请奖励' }

Page({
  data: {
    activity: null,
    myTickets: [],
    inviteCode: '',
    safeAreaBottom: 0,
    statusBarHeight: 0,
    navBarHeight: 0,
    loading: true
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height,
      safeAreaBottom: systemInfo.safeArea ? systemInfo.screenHeight - systemInfo.safeArea.bottom : 0,
      inviteCode: app.globalData.userInfo ? app.globalData.userInfo.inviteCode || 'CAMPUS88' : 'CAMPUS88'
    })

    const id = parseInt(options.id)
    if (!id) return

    this._loadData(id)
  },

  _loadData(activityId) {
    this.setData({ loading: true })
    Promise.all([
      getActivityDetail(activityId),
      getMyTickets(activityId)
    ]).then(([activity, tickets]) => {
      this.setData({
        activity,
        myTickets: tickets.map(t => ({ ...t, sourceLabel: SOURCE_LABEL[t.source] || '' })),
        loading: false
      })
    }).catch(err => {
      console.error('加载活动详情失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  onShareInvite() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  navigateBack() {
    wx.navigateBack()
  }
})
