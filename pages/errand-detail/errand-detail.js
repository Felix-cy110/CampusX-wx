const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')
const { requireAuth } = require('../../utils/auth')

function formatDateTime(value) {
  if (!value) return ''
  if (Array.isArray(value)) {
    const y = value[0]
    const m = String(value[1]).padStart(2, '0')
    const d = String(value[2]).padStart(2, '0')
    const h = String(value[3] || 0).padStart(2, '0')
    const minute = String(value[4] || 0).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${minute}`
  }
  return String(value).replace('T', ' ').slice(0, 16)
}

function buildShareTitle(value, type) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return type === 'supply' ? '分享一个代课供给' : '分享一个代课需求'
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,

    demand: null,
    detailType: 'demand',
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

    const id = options.id || ''
    const detailType = options.type === 'supply' ? 'supply' : 'demand'
    this.setData({
      statusBarHeight,
      navBarHeight,
      detailType,
      isLoggedIn: app.globalData.isLoggedIn
    })

    // 从存储中读取跑腿数据
    const demand = wx.getStorageSync('currentErrand')
    if (demand && (!id || String(demand.id) === String(id))) {
      const cachedType = demand.type === 'supply' ? 'supply' : detailType
      this.setData({ demand, detailType: cachedType, loading: false })
      wx.removeStorageSync('currentErrand')
    } else {
      if (demand) wx.removeStorageSync('currentErrand')
      if (id) {
        this.loadDemandById(id, detailType)
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: '数据不存在', icon: 'none' })
      }
    }
  },

  onShareAppMessage() {
    const demand = this.data.demand || {}
    return {
      title: buildShareTitle(demand.title, this.data.detailType),
      path: '/pages/errand-detail/errand-detail?id=' + encodeURIComponent(demand.id || '') +
        '&type=' + encodeURIComponent(this.data.detailType)
    }
  },

  onShow() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn
    })
  },

  loadDemandById(id, detailType) {
    const isSupply = detailType === 'supply'
    request({
      url: isSupply
        ? '/api/v1/proxy-class-supply/' + id
        : '/api/v1/proxy-class-demand/' + id,
      method: 'GET'
    }).then(vo => {
      const demand = isSupply ? this.mapSupplyDetail(vo) : this.mapDemandDetail(vo)
      this.setData({ demand, loading: false })
    }).catch(err => {
      console.error('加载跑腿详情失败:', err)
      this.setData({ demand: null, loading: false })
      wx.showToast({ title: (err && err.message) || '数据加载失败，请返回重试', icon: 'none' })
    })
  },

  mapDemandDetail(vo) {
    const location = [vo.locationCampus, vo.locationBuilding, vo.locationRoom].filter(Boolean).join(' ')
    const content = [location, formatDateTime(vo.classTime), vo.remark].filter(Boolean).join('\n')
    return {
      id: vo.id,
      type: 'errand',
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '/images/avatars/default.png'
      },
      title: vo.courseName || '',
      content: content || vo.courseName || '',
      reward: vo.fee != null ? Number(vo.fee) : 0,
      time: formatDateTime(vo.createdAt),
      status: vo.status,
      _raw: { onlySameSchool: vo.onlySameSchool }
    }
  },

  mapSupplyDetail(vo) {
    return {
      id: vo.id,
      type: 'supply',
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '/images/avatars/default.png'
      },
      title: vo.subjectRange || '',
      content: vo.availableTime || '',
      reward: vo.expectedFee != null ? Number(vo.expectedFee) : 0,
      time: formatDateTime(vo.createdAt),
      status: vo.status,
      _raw: {}
    }
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
    const { demand } = this.data
    if (!demand || !demand.user) return
    safeNavigate({
      url: `/pages/chat/chat?userId=${demand.user.uid || ''}&name=${encodeURIComponent(demand.user.name || '')}&avatar=${encodeURIComponent(demand.user.avatar || '')}`
    })
  },

  /* 下单（申请接单） */
  applyOrder() {
    if (this.data.detailType === 'supply') {
      this.contactUser()
      return
    }
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
    return requireAuth()
  }
})
