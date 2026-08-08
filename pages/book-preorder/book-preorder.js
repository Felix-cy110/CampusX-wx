const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    activeTab: 'ongoing',
    filteredList: [],
    statusBarHeight: 0,
    navBarHeight: 0,
    loading: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })
    this.loadList('ongoing')
  },

  switchTab(e) {
    if (this.data.loading) return
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadList(tab)
  },

  mapItem(vo) {
    return {
      ...vo,
      coverImage: toFullUrl(vo.coverImage)
    }
  },

  loadList(tab) {
    this.setData({ loading: true })
    const status = tab === 'ongoing' ? 1 : 2
    request({
      url: '/api/v1/presale',
      method: 'GET',
      data: { status, pageSize: 20 }
    }).then(data => {
      const list = (data && data.list) || []
      const filteredList = list.map(this.mapItem.bind(this))
      this.setData({ filteredList, loading: false })
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ filteredList: [], loading: false })
    })
  },

  onTapItem(e) {
    safeNavigate({ url: `/pages/book-preorder-detail/book-preorder-detail?id=${e.currentTarget.dataset.id}` })
  },

  onTapMyOrders() {
    safeNavigate({ url: '/pages/book-preorder-detail/book-preorder-detail?myOrders=1' })
  },

  navigateBack() {
    wx.navigateBack()
  }
})
