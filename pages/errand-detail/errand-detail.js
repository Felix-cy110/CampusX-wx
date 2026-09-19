const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')
const { confirmAndApplyProxyOrder } = require('../../utils/proxyOrder')

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
    /* 导航栏右侧分享按钮与胶囊按钮的安全间距（px），按胶囊实际位置动态计算 */
    capsuleGap: 0,

    demand: null,
    detailId: '',
    detailType: 'demand',
    orderId: '',
    order: null,
    loading: true,
    loadError: '',
    applying: false,

    // 用户信息
    isLoggedIn: true
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    // 与其他详情页一致：按胶囊真实坐标计算安全间距，适配所有机型
    const capsuleGap = systemInfo.windowWidth - menuButton.left + 8

    const id = options.id || ''
    const orderId = String(options.orderId || '')
    const detailType = options.type === 'supply' ? 'supply' : 'demand'
    this.setData({
      statusBarHeight,
      navBarHeight,
      capsuleGap,
      detailId: String(id),
      detailType,
      orderId,
      isLoggedIn: app.globalData.isLoggedIn
    })

    // 订单详情由后端校验交易双方权限，不受公开需求状态或首页缓存影响。
    if (orderId) {
      wx.hideShareMenu()
      return this.loadOrderById(orderId)
    }

    // 从存储中读取跑腿数据
    const demand = wx.getStorageSync('currentErrand')
    if (demand && (!id || String(demand.id) === String(id))) {
      const cachedType = demand.type === 'supply' ? 'supply' : detailType
      this.setData({ demand, detailType: cachedType, loading: false })
      wx.removeStorageSync('currentErrand')
    } else {
      if (demand) wx.removeStorageSync('currentErrand')
      if (id) {
        return this.loadDemandById(id, detailType)
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
    this.setData({ loading: true, loadError: '' })
    return request({
      url: isSupply
        ? '/api/v1/proxy-class-supply/' + id
        : '/api/v1/proxy-class-demand/' + id,
      method: 'GET'
    }).then(vo => {
      const demand = isSupply ? this.mapSupplyDetail(vo) : this.mapDemandDetail(vo)
      this.setData({ demand, loading: false })
    }).catch(err => {
      console.error('加载跑腿详情失败:', err)
      const loadError = (err && err.message) || '数据加载失败，请重试'
      this.setData({ demand: null, loading: false, loadError })
      wx.showToast({ title: loadError, icon: 'none' })
    })
  },

  loadOrderById(orderId) {
    this.setData({ loading: true, loadError: '', demand: null, order: null })
    return request({
      url: '/api/v1/proxy-class-order/detail',
      method: 'GET',
      data: { orderId }
    }).then(vo => {
      const currentUid = (app.globalData.userInfo || {}).uid
      const isBuyer = String(currentUid) === String(vo.buyerId)
      const location = [vo.locationCampus, vo.locationBuilding, vo.locationRoom].filter(Boolean).join(' ')
      const demand = {
        id: vo.demandId,
        type: 'errand',
        title: vo.courseName || '',
        content: [location, formatDateTime(vo.classTime)].filter(Boolean).join('\n'),
        reward: vo.fee != null ? Number(vo.fee) : 0,
        time: formatDateTime(vo.createdAt),
        user: {
          uid: String((isBuyer ? vo.sellerId : vo.buyerId) || ''),
          name: (isBuyer ? vo.sellerNickname : vo.buyerNickname) || '',
          avatar: toFullUrl(isBuyer ? vo.sellerAvatarUrl : vo.buyerAvatarUrl) || '/images/avatars/default.png'
        }
      }
      this.setData({
        demand,
        detailType: 'demand',
        order: {
          orderNo: vo.orderNo,
          statusDesc: vo.statusDesc || '未知状态',
          createdAt: formatDateTime(vo.createdAt),
          side: isBuyer ? 'buy' : 'sell',
          contactRole: isBuyer ? '接单人' : '发布者'
        },
        loading: false
      })
    }).catch(err => {
      console.error('加载跑腿订单详情失败:', err)
      const loadError = (err && err.message) || '订单加载失败，请重试'
      this.setData({ demand: null, order: null, loading: false, loadError })
      wx.showToast({ title: loadError, icon: 'none' })
    })
  },

  retryLoad() {
    if (this.data.loading) return
    if (this.data.orderId) return this.loadOrderById(this.data.orderId)
    if (this.data.detailId) return this.loadDemandById(this.data.detailId, this.data.detailType)
  },

  viewOrders() {
    const pages = getCurrentPages()
    if (pages.length > 1 && pages[pages.length - 2].route === 'pages/order/order') {
      wx.navigateBack()
      return
    }
    safeNavigate({ url: '/pages/order/order?tab=errand&side=' + ((this.data.order || {}).side || 'buy') })
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
  async applyOrder() {
    if (this.data.orderId) return
    if (this.data.detailType === 'supply') {
      this.contactUser()
      return
    }
    if (this.data.applying) return

    const { demand } = this.data
    if (!demand || !demand.id) return

    this.setData({ applying: true })
    try {
      await confirmAndApplyProxyOrder(demand)
    } finally {
      this.setData({ applying: false })
    }
  }
})
