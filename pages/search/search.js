const { safeNavigate } = require('../../utils/safeNavigate')

const HISTORY_KEY = 'searchHistory'
const MAX_HISTORY = 20

Page({
  data: {
    searchValue: '',
    searchHistory: [],
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    // 从本地缓存加载搜索历史
    const history = wx.getStorageSync(HISTORY_KEY) || []

    this.setData({
      searchHistory: history,
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight
    })
  },

  onInput(e) {
    this.setData({ searchValue: e.detail.value })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  onClearInput() {
    this.setData({ searchValue: '' })
  },

  onSearch() {
    const keyword = this.data.searchValue.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入搜索内容', icon: 'none' })
      return
    }
    // 历史保存在搜索结果页请求成功后再执行，避免"历史秒出、结果等几秒"的割裂感
    safeNavigate({ url: '/pages/search-result/search-result?keyword=' + encodeURIComponent(keyword), showLoading: false })
  },

  onTapHistory(e) {
    const keyword = e.currentTarget.dataset.keyword
    safeNavigate({ url: '/pages/search-result/search-result?keyword=' + encodeURIComponent(keyword), showLoading: false })
  },

  onClearHistory() {
    wx.removeStorageSync(HISTORY_KEY)
    this.setData({ searchHistory: [] })
    wx.showToast({ title: '已清除搜索历史', icon: 'none' })
  },

  /**
   * 保存关键词到本地搜索历史
   * - 去重：已存在的关键词移到最前
   * - 限长：最多保留 MAX_HISTORY 条
   */
  saveHistory(keyword) {
    let history = this.data.searchHistory.slice()
    // 去重
    const idx = history.indexOf(keyword)
    if (idx !== -1) {
      history.splice(idx, 1)
    }
    // 新词插到最前
    history.unshift(keyword)
    // 截断
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY)
    }
    // 写回本地和 data
    wx.setStorageSync(HISTORY_KEY, history)
    this.setData({ searchHistory: history })
  }
})
