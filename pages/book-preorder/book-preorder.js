const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    activeTab: 'ongoing',
    filteredList: [],
    statusBarHeight: 0,
    navBarHeight: 0,
    loading: false,
    loadError: '',
    nextCursor: null
  },

  onLoad(options = {}) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })
    const activeTab = options.tab === 'orders' ? 'orders' : 'ongoing'
    this.setData({ activeTab })
    return this.loadList(activeTab)
  },

  switchTab(e) {
    if (this.data.loading) return
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    return this.loadList(tab)
  },

  mapItem(vo) {
    return {
      ...vo,
      coverImage: toFullUrl(vo.coverImage)
    }
  },

  mapOrder(vo) {
    const labels = ['待付定金', '待付尾款', '已完成', '已取消', '已退款取消']
    return { ...vo, statusLabel: labels[Number(vo.status)] || '未知状态' }
  },

  loadList(tab, append = false) {
    if (this.data.loading) return
    this.setData({ loading: true, loadError: '', ...(!append ? { filteredList: [], nextCursor: null } : {}) })
    const status = tab === 'ongoing' ? 1 : 2
    const isOrders = tab === 'orders'
    return request({
      url: isOrders ? '/api/v1/presale/orders/my' : '/api/v1/presale',
      method: 'GET',
      data: { ...(!isOrders ? { status } : {}), pageSize: 20, ...(append ? { cursor: this.data.nextCursor } : {}) }
    }).then(data => {
      if (!data || !Array.isArray(data.list)) throw new Error('预购列表加载异常，请重试')
      const list = data.list.filter(item => item && item.id != null)
      const items = list.map(isOrders ? this.mapOrder.bind(this) : this.mapItem.bind(this))
      const filteredList = append ? this.data.filteredList.concat(items) : items
      this.setData({ filteredList, loading: false, nextCursor: data.nextCursor == null ? null : data.nextCursor })
    }).catch(err => {
      this.setData({ loading: false, loadError: (err && err.message) || '加载失败，请重试' })
    })
  },

  loadMore() {
    if (this.data.nextCursor == null || this.data.loading || this.data.loadError) return
    return this.loadList(this.data.activeTab, true)
  },

  retryLoad() {
    return this.loadList(this.data.activeTab, this.data.filteredList.length > 0)
  },

  onTapItem(e) {
    const { id, orderId } = e.currentTarget.dataset
    if (!/^[1-9]\d*$/.test(String(id || '')) || (orderId != null && !/^[1-9]\d*$/.test(String(orderId)))) {
      wx.showToast({ title: '预购链接无效，请刷新列表', icon: 'none' })
      return
    }
    const orderQuery = orderId == null ? '' : `&orderId=${orderId}`
    safeNavigate({ url: `/pages/book-preorder-detail/book-preorder-detail?id=${id}${orderQuery}` })
  },

  onTapMyOrders() {
    if (this.data.loading) return
    this.setData({ activeTab: 'orders' })
    return this.loadList('orders')
  },

  navigateBack() {
    wx.navigateBack()
  }
})
