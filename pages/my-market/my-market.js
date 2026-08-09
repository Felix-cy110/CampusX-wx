const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    marketItems: [],
    loading: false,
    pageNum: 1,
    hasMore: true
  },
  onLoad() {
    this.loadMyProducts(1, true)
  },

  /** 从后端加载我的闲置商品 */
  loadMyProducts(pageNum = 1, reset = false) {
    if (this.data.loading) return
    this.setData({ loading: true })

    request({
      url: '/api/v1/idle/product/my-list',
      method: 'GET',
      data: { pageNum, pageSize: 20 }
    }).then(data => {
      const newList = (data.list || []).map(vo => this.mapSellerProduct(vo))
      const marketItems = reset ? newList : [...this.data.marketItems, ...newList]
      const hasMore = (data.list && data.list.length >= 20)

      this.setData({
        marketItems,
        pageNum,
        hasMore,
        loading: false
      })
    }).catch(err => {
      console.error('加载我的闲置商品失败:', err)
      this.setData({ loading: false })
      if (reset) {
        wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
      }
    })
  },

  /** 映射卖家商品 VO */
  mapSellerProduct(vo) {
    return {
      id: vo.productId,
      title: vo.title || '',
      price: vo.price != null ? Number(vo.price) : 0,
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      status: vo.statusDesc || '',
      statusVal: vo.status,
      category: vo.category || '',
      conditionLevel: vo.conditionLevel,
      deliveryType: vo.deliveryType,
      isExpiringSoon: vo.isExpiringSoon,
      createdAt: vo.createdAt,
      type: vo.subType === 1 ? 'book' : 'item'
    }
  },

  /** 下拉刷新 */
  onRefresh() {
    this.setData({ pageNum: 1 })
    this.loadMyProducts(1, true)
  },

  /** 加载更多 */
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.loadMyProducts(this.data.pageNum + 1, false)
  },

  /** 删除 / 下架 */
  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定要下架这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          request({
            url: `/api/v1/idle/product/${id}/off-shelf`,
            method: 'PUT'
          }).then(() => {
            const marketItems = this.data.marketItems.filter(item => item.id !== id)
            this.setData({ marketItems })
            wx.showToast({ title: '已下架', icon: 'success' })
          }).catch(err => {
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
          })
        }
      }
    })
  },

  /** 重新上架 */
  onRelist(e) {
    const id = e.currentTarget.dataset.id
    request({
      url: `/api/v1/idle/product/${id}/on-shelf`,
      method: 'PUT'
    }).then(() => {
      wx.showToast({ title: '已重新上架', icon: 'success' })
      this.loadMyProducts(1, true)
    }).catch(err => {
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  /** 跳转详情 */
  goToDetail(e) {
    const { id, type } = e.currentTarget.dataset
    safeNavigate({ url: `/pages/market-detail/market-detail?id=${id}&type=${type || 'book'}` })
  }
})
