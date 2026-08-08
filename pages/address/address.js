const { request } = require('../../utils/request')

Page({
  data: {
    addressList: [],
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })
  },

  onShow() {
    this.loadAddressList()
  },

  /* 从后端加载地址列表 */
  loadAddressList() {
    request({
      url: '/api/v1/address/list',
      method: 'GET'
    }).then(list => {
      const addressList = (list || []).map(vo => ({
        id: vo.id,
        campus: vo.campus || '',
        building: vo.building || '',
        room: vo.room || '',
        isDefault: vo.isDefault === 1,
        fullAddress: (vo.campus || '') + '-' + (vo.building || '') + '-' + (vo.room || '')
      }))
      this.setData({ addressList })
    }).catch(err => {
      console.error('加载地址列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onBack() {
    wx.navigateBack()
  },

  /* 跳转到新增地址页 */
  addNewAddress() {
    wx.navigateTo({ url: '/pages/address-form/address-form' })
  },

  /* 跳转到编辑地址页 */
  editAddress(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.addressList.find(a => String(a.id) === String(id))
    if (!item) return
    wx.setStorageSync('addressFormData', {
      id: item.id,
      campus: item.campus,
      building: item.building,
      room: item.room,
      isDefault: item.isDefault
    })
    wx.navigateTo({ url: '/pages/address-form/address-form' })
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          request({
            url: '/api/v1/address/' + id,
            method: 'DELETE'
          }).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadAddressList()
          }).catch(err => {
            wx.hideLoading()
            console.error('删除地址失败:', err)
            wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  /* 设为默认地址 */
  setDefault(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '设置中...' })
    request({
      url: '/api/v1/address/' + id + '/default',
      method: 'PUT'
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '已设为默认地址', icon: 'success' })
      this.loadAddressList()
    }).catch(err => {
      wx.hideLoading()
      console.error('设置默认地址失败:', err)
      wx.showToast({ title: (err && err.message) || '设置失败', icon: 'none' })
    })
  },

  selectAddress(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.addressList.find(a => String(a.id) === String(id))
    if (!item) return
    wx.setStorageSync('selectedAddress', item)
    wx.showToast({ title: '已选择：' + item.fullAddress, icon: 'none' })
    setTimeout(() => {
      wx.navigateBack()
    }, 1000)
  },

  preventBubble() {
    // 阻止事件冒泡
  }
})
