const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    reason: '',
    idImages: [],
    targetSchool: '',
    targetMajor: ''
  },

  onLoad() {
    const userInfo = app.globalData.userInfo
    this.setData({
      targetSchool: userInfo.school || '',
      targetMajor: userInfo.major || ''
    })
  },

  onShow() {
    const selectedSchool = wx.getStorageSync('selectedSchool')
    const selectedMajor = wx.getStorageSync('selectedMajor')
    if (selectedSchool) {
      this.setData({ targetSchool: selectedSchool })
      wx.removeStorageSync('selectedSchool')
    }
    if (selectedMajor) {
      this.setData({ targetMajor: selectedMajor })
      wx.removeStorageSync('selectedMajor')
    }
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  addImage() {
    if (this.data.idImages.length >= 3) return
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ idImages: this.data.idImages.concat(res.tempFilePaths) })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.idImages
    images.splice(index, 1)
    this.setData({ idImages: images })
  },

  selectSchool() {
    safeNavigate({ url: '/pages/select-school/select-school' })
  },

  selectMajor() {
    safeNavigate({ url: '/pages/select-major/select-major' })
  },

  onSubmit() {
    if (!this.data.reason.trim()) {
      wx.showToast({ title: '请输入申诉原因', icon: 'none' })
      return
    }
    if (this.data.idImages.length < 3) {
      wx.showToast({ title: '请上传全部证件照片', icon: 'none' })
      return
    }
    wx.showToast({ title: '申诉已提交', icon: 'success' })
    setTimeout(() => { wx.navigateBack() }, 1500)
  }
})
