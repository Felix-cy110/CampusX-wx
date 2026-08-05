const { request } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    campus: '',
    building: '',
    room: '',
    isDefault: false,
    canSubmit: false,
    isEditing: false,
    editId: null,
    submitting: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })

    // 读取编辑数据（如果有）
    const formData = wx.getStorageSync('addressFormData')
    if (formData) {
      wx.removeStorageSync('addressFormData')
      this.setData({
        isEditing: true,
        editId: formData.id,
        campus: formData.campus || '',
        building: formData.building || '',
        room: formData.room || '',
        isDefault: formData.isDefault || false,
        canSubmit: true
      })
    }
  },

  onCampusInput(e) {
    this.setData({ campus: e.detail.value })
    this.checkCanSubmit()
  },

  onBuildingInput(e) {
    this.setData({ building: e.detail.value })
    this.checkCanSubmit()
  },

  onRoomInput(e) {
    this.setData({ room: e.detail.value })
    this.checkCanSubmit()
  },

  onDefaultChange(e) {
    this.setData({ isDefault: e.detail.value })
  },

  checkCanSubmit() {
    const { campus, building, room } = this.data
    this.setData({
      canSubmit: !!(campus.trim() && building.trim() && room.trim())
    })
  },

  onBack() {
    wx.navigateBack()
  },

  submit() {
    if (!this.data.canSubmit || this.data.submitting) return
    const { campus, building, room, isDefault, isEditing, editId } = this.data

    this.setData({ submitting: true })

    const dto = {
      campus: campus.trim(),
      building: building.trim(),
      room: room.trim(),
      isDefault: isDefault ? 1 : 0
    }

    let promise
    if (isEditing && editId) {
      dto.id = editId
      promise = request({ url: '/api/v1/address', method: 'PUT', data: dto })
    } else {
      promise = request({ url: '/api/v1/address', method: 'POST', data: dto })
    }

    promise.then(() => {
      wx.hideLoading()
      wx.showToast({
        title: isEditing ? '地址已更新' : '地址已保存',
        icon: 'success',
        duration: 1500,
        complete: () => {
          wx.navigateBack()
        }
      })
    }).catch(err => {
      this.setData({ submitting: false })
      console.error('保存地址失败:', err)
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
    })
  }
})
