const mock = require('../../utils/mock.js')

Page({
  data: {
    sortType: 'time_desc',
    priceFrom: '',
    priceTo: '',
    selectedCategory: '',
    categories: ['全部', '二手书', '数码', '其他闲置', '美食', '课程', '动物']
  },

  onLoad() {
    // 页面加载
  },

  onSortChange() {
    const types = ['发布时间 近-远', '发布时间 远-近', '价格 低-高', '价格 高-低']
    wx.showActionSheet({
      itemList: types,
      success: (res) => {
        this.setData({ sortType: ['time_desc', 'time_asc', 'price_asc', 'price_desc'][res.tapIndex] })
      }
    })
  },

  onPriceFromInput(e) {
    this.setData({ priceFrom: e.detail.value })
  },

  onPriceToInput(e) {
    this.setData({ priceTo: e.detail.value })
  },

  onConfirmPrice() {
    const from = parseFloat(this.data.priceFrom)
    const to = parseFloat(this.data.priceTo)
    if (isNaN(from) || isNaN(to)) {
      wx.showToast({ title: '请输入有效的价格区间', icon: 'none' })
      return
    }
    if (from > to) {
      wx.showToast({ title: '起始价格不能大于结束价格', icon: 'none' })
      return
    }
    wx.showToast({ title: '价格区间已设置', icon: 'none' })
  },

  onSelectCategory(e) {
    const cat = e.currentTarget.dataset.category
    this.setData({ selectedCategory: this.data.selectedCategory === cat ? '' : cat })
  },

  onApply() {
    wx.showToast({ title: '筛选条件已应用', icon: 'none' })
    wx.navigateBack()
  },

  onReset() {
    this.setData({
      sortType: 'time_desc',
      priceFrom: '',
      priceTo: '',
      selectedCategory: ''
    })
    wx.showToast({ title: '已重置筛选条件', icon: 'none' })
  }
})
