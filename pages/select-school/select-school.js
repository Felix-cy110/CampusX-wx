const { request } = require('../../utils/request')
const mock = require('../../utils/mock')

Page({
  data: {
    searchText: '',
    schools: [],
    filteredSchools: [],
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight
    })

    this.fetchSchools()
  },

  // 获取高校列表（mock 阶段直接使用本地数据）
  fetchSchools() {
    wx.showLoading({ title: '加载中...' })
    request({
      url: '/api/v1/campus/list',
      method: 'GET'
    }).then(list => {
      wx.hideLoading()
      this.setData({ schools: list, filteredSchools: list })
    }).catch(err => {
      wx.hideLoading()
      console.log('获取高校列表失败，使用 mock 数据:', err)
      const list = mock.schools || []
      this.setData({ schools: list, filteredSchools: list })
    })
  },

  // 搜索
  onSearch(e) {
    const searchText = e.detail.value.trim()
    this.setData({ searchText })

    if (!searchText) {
      this.setData({ filteredSchools: this.data.schools })
      return
    }

    const filtered = this.data.schools.filter(item =>
      item.name.includes(searchText)
    )
    this.setData({ filteredSchools: filtered })
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchText: '',
      filteredSchools: this.data.schools
    })
  },

  // 选择学校
  selectSchool(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    // 传递 { id, name } 对象
    wx.setStorageSync('selectedSchool', JSON.stringify({ id, name }))
    wx.navigateBack({ delta: 1 })
  },

  // 返回
  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
