const { getActivityDetail, getMyTickets } = require('../../utils/api/lottery')
const { request, toFullUrl } = require('../../utils/request')
const app = getApp()

const SOURCE_LABEL = { 1: '付费发帖', 2: '交易达标', 3: '邀请奖励' }

Page({
  data: {
    activity: null,
    activityId: null,
    myTickets: [],
    inviteCode: '',
    statusBarHeight: 0,
    navBarHeight: 0,
    loading: true
  },

  onLoad(options) {
    if (wx.hideShareMenu) wx.hideShareMenu()
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height,
      inviteCode: app.globalData.userInfo ? app.globalData.userInfo.inviteCode || '' : ''
    })

    const id = parseInt(options.id)
    if (!id) return

    this.setData({ activityId: id })
    this._loadInviteCode()
    this._loadData(id)
  },

  _loadInviteCode() {
    request({ url: '/api/v1/user/me', method: 'GET' }).then(vo => {
      const inviteCode = vo.inviteCode || ''
      this.setData({ inviteCode })
      if (app.globalData.userInfo) app.globalData.userInfo.inviteCode = inviteCode
      if (inviteCode && wx.showShareMenu) {
        wx.showShareMenu({ menus: ['shareAppMessage'] })
      }
    }).catch(err => {
      console.warn('加载邀请码失败:', err)
    })
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
    wx.showToast({ title: '邀请码加载中，请稍后重试', icon: 'none' })
  },

  onShareAppMessage() {
    const activity = this.data.activity || {}
    const inviteCode = this.data.inviteCode || ''
    const shareConfig = {
      title: activity.title ? '邀你参加「' + activity.title + '」' : '邀请你加入 CampusX',
      path: '/pages/invite-detail/invite-detail?id=' + encodeURIComponent(this.data.activityId) +
        (inviteCode ? '&inviteCode=' + encodeURIComponent(inviteCode) : '')
    }
    if (activity.coverImage) shareConfig.imageUrl = toFullUrl(activity.coverImage)
    return shareConfig
  },

  navigateBack() {
    wx.navigateBack()
  }
})
