const { getActivities } = require('../../utils/api/lottery')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    activeTab: 'ongoing',
    filteredList: [],
    statusBarHeight: 0,
    navBarHeight: 0,

    /* 全部活动数据（从 API 加载） */
    allActivities: [],
    /* 游标分页 */
    cursor: null,
    hasMore: true,
    loading: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })
    this._loadActivities()
  },

  /* 下拉刷新 */
  onRefresh() {
    this.setData({ cursor: null, hasMore: true, allActivities: [] })
    this._loadActivities().finally(() => {
      this.setData({ refreshing: false })
    })
  },

  /* 滚动到底部加载更多 */
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this._loadActivities()
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this._filterList(tab)
  },

  _loadActivities() {
    if (this.data.loading) return Promise.resolve()
    this.setData({ loading: true })
    const size = 20
    return getActivities(this.data.cursor, size).then(res => {
      const merged = this.data.allActivities.concat(res.list)
      this.setData({
        allActivities: merged,
        cursor: res.nextCursor,
        hasMore: res.hasMore,
        loading: false
      })
      this._filterList(this.data.activeTab)
    }).catch(err => {
      console.error('加载活动列表失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  _filterList(tab) {
    const list = this.data.allActivities.filter(a =>
      tab === 'ongoing' ? a.status === 0 : a.status !== 0
    )
    this.setData({ filteredList: list })
  },

  onTapItem(e) {
    safeNavigate({ url: `/pages/invite-detail/invite-detail?id=${e.currentTarget.dataset.id}` })
  },

  navigateBack() {
    wx.navigateBack()
  }
})
