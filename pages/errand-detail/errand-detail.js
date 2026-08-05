const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,

    demand: null,
    loading: true,
    applying: false,

    // 用户信息
    isLoggedIn: true
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    this.setData({
      statusBarHeight,
      navBarHeight,
      isLoggedIn: app.globalData.isLoggedIn
    })

    // 从存储中读取跑腿数据
    const demand = wx.getStorageSync('currentErrand')
    if (demand) {
      this.setData({ demand, loading: false })
      wx.removeStorageSync('currentErrand')
    } else {
      // 如果没有数据，尝试通过 id 加载（预留后端接口）
      const id = options.id
      if (id) {
        this.loadDemandById(id)
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: '数据不存在', icon: 'none' })
      }
    }
  },

  onShow() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn
    })
  },

  /* 预留：通过 ID 加载需求详情（后端接口就绪后使用） */
  loadDemandById(id) {
    this.setData({ loading: false })
    wx.showToast({ title: '数据加载失败，请返回重试', icon: 'none' })
  },

  goBack() {
    wx.navigateBack()
  },

  /* 跳转用户主页 */
  goToUserProfile() {
    const { demand } = this.data
    if (!demand || !demand.user) return
    const currentUid = (app.globalData.userInfo || {}).uid
    if (demand.user.uid && String(demand.user.uid) === String(currentUid)) {
      wx.switchTab({ url: '/pages/profile/profile' })
      return
    }
    safeNavigate({
      url: `/pages/user-home/user-home?userId=${demand.user.uid || ''}&name=${encodeURIComponent(demand.user.name || '')}&avatar=${encodeURIComponent(demand.user.avatar || '')}`
    })
  },

  /* 联系发布者 */
  contactUser() {
    if (!this.requireLogin()) return
    const { demand } = this.data
    if (!demand || !demand.user) return
    safeNavigate({
      url: `/pages/chat/chat?userId=${demand.user.uid || ''}&name=${encodeURIComponent(demand.user.name || '')}&avatar=${encodeURIComponent(demand.user.avatar || '')}`
    })
  },

  /* 下单（申请接单） */
  applyOrder() {
    if (!this.requireLogin()) return
    if (this.data.applying) return

    const { demand } = this.data
    if (!demand || !demand.id) return

    // 不能接自己的单
    const currentUid = (app.globalData.userInfo || {}).uid
    if (demand.user.uid && String(demand.user.uid) === String(currentUid)) {
      wx.showToast({ title: '不能接自己发布的跑腿', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认接单',
      content: `确定要接下「${demand.title || ''}」这个跑腿任务吗？代课费 ￥${demand.reward || 0}`,
      success: (res) => {
        if (res.confirm) {
          this.doApply()
        }
      }
    })
  },

  async doApply() {
    this.setData({ applying: true })
    wx.showLoading({ title: '下单中...', mask: true })

    try {
      await request({
        url: '/api/v1/proxy-class-order/apply',
        method: 'POST',
        data: { demandId: this.data.demand.id }
      })

      wx.hideLoading()
      wx.showToast({ title: '下单成功', icon: 'success' })

      // 延迟跳转到订单页面
      setTimeout(() => {
        wx.switchTab({ url: '/pages/profile/profile' })
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('下单失败:', err)
      const msg = (err && err.message) || '下单失败，请重试'
      wx.showToast({ title: msg, icon: 'none', duration: 2000 })
    } finally {
      this.setData({ applying: false })
    }
  },

  requireLogin() {
    if (!app.globalData.isLoggedIn) {
      safeNavigate({ url: '/pages/login/login' })
      return false
    }
    return true
  }
})
