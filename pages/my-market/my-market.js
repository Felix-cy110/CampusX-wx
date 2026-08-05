const app = getApp()
const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    marketItems: [],
    pageNum: 1,
    hasMore: true,
    loading: false,
    refreshing: false
  },

  onLoad() {
    this.loadMyMarket()
  },

  /* 从 API 加载我的闲置商品：GET /api/v1/idle/product/my-list（分页，与 profile.js 一致）*/
  loadMyMarket(pageNum) {
    if (this.data.loading) return Promise.resolve()
    const pn = pageNum || 1
    this.setData({ loading: true })
    return request({
      url: '/api/v1/idle/product/my-list',
      data: { pageNum: pn, pageSize: 20 }
    }).then(result => {
      const list = (result.list || result.records || []).map(vo => this._mapIdleItem(vo))
      const items = pn === 1 ? list : [...this.data.marketItems, ...list]
      const totalPages = result.pages || 1
      this.setData({
        marketItems: items,
        pageNum: pn,
        hasMore: pn < totalPages,
        loading: false
      })
    }).catch(err => {
      console.error('加载我的集市帖子失败:', err)
      this.setData({ loading: false })
      if (pn === 1) {
        wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none', duration: 2000 })
      }
    })
  },

  /* 将 IdleSellerProductVO 映射为前端卡片格式（与 profile.js _mapIdleToCard 一致）*/
  _mapIdleItem(vo) {
    let timeStr = ''
    if (vo.createdAt) {
      if (Array.isArray(vo.createdAt)) {
        const [y, m, d, h, mi] = vo.createdAt
        timeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
      } else if (typeof vo.createdAt === 'string') {
        timeStr = vo.createdAt.replace('T', ' ').slice(0, 16)
      }
    }
    const statusMap = { 0: 'pending', 1: 'available', 2: 'off_shelf', 3: 'sold', 4: 'rejected', 5: 'pending' }
    const userInfo = app.globalData.userInfo || {}
    return {
      id: 'idle_' + (vo.productId || vo.id),
      user: {
        uid: String(vo.userId || userInfo.uid || ''),
        name: vo.sellerName || vo.nickname || userInfo.nickname || '',
        avatar: toFullUrl(vo.sellerAvatar || vo.avatarUrl) || userInfo.avatar || ''
      },
      title: vo.title || '',
      content: vo.description || vo.content || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      price: vo.price || 0,
      originalPrice: vo.originalPrice || 0,
      tag: vo.category || vo.condition || '闲置',
      time: timeStr,
      status: statusMap[vo.status] || 'available',
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      _backendId: vo.productId || vo.id,
      _backendType: 'idle'
    }
  },

  /* 下拉刷新 */
  onRefresh() {
    this.setData({ refreshing: true, pageNum: 1, loading: false })
    this.loadMyMarket(1).finally(() => {
      this.setData({ refreshing: false })
    })
  },

  /* 上拉加载更多 */
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.loadMyMarket(this.data.pageNum + 1)
  },

  /* 删除（下架）：PUT /api/v1/idle/product/{id}/off-shelf（与 profile.js 一致）*/
  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.marketItems.find(i => String(i.id) === String(id))
    const backendId = item && item._backendId ? item._backendId : id
    wx.showModal({
      title: '提示',
      content: '确定要下架这条集市帖子吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '下架中...' })
          request({ url: '/api/v1/idle/product/' + backendId + '/off-shelf', method: 'PUT' })
            .then(() => {
              wx.hideLoading()
              const items = this.data.marketItems.filter(i => String(i.id) !== String(id))
              this.setData({ marketItems: items })
              wx.showToast({ title: '已下架', icon: 'success' })
            })
            .catch(err => {
              wx.hideLoading()
              console.error('下架商品失败:', err)
              wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none' })
            })
        }
      }
    })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.marketItems.find(i => String(i.id) === String(id))
    const navId = item && item._backendId ? item._backendId : id
    safeNavigate({ url: '/pages/market-detail/market-detail?id=' + navId })
  }
})
