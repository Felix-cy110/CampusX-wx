const { safeNavigate } = require('../../utils/safeNavigate')
const { request } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,

    // 可代课程范围
    subjectRange: '',
    subjectRangeMax: 100,

    // 可用时间段
    availableTime: '',
    availableTimeMax: 200,

    // 期望报酬
    expectedFee: '',

    publishing: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
  },

  goBack() {
    wx.navigateBack()
  },

  onSubjectRangeInput(e) {
    this.setData({ subjectRange: e.detail.value })
  },

  onAvailableTimeInput(e) {
    this.setData({ availableTime: e.detail.value })
  },

  onExpectedFeeInput(e) {
    this.setData({ expectedFee: e.detail.value })
  },

  // ===== 提交 =====
  async onSubmit() {
    if (this.data.publishing) return

    const { subjectRange, availableTime, expectedFee } = this.data

    // 校验
    if (!subjectRange.trim()) {
      wx.showToast({ title: '请输入可代课程范围', icon: 'none' })
      return
    }
    if (!availableTime.trim()) {
      wx.showToast({ title: '请输入可用时间段', icon: 'none' })
      return
    }
    if (!expectedFee || parseFloat(expectedFee) <= 0) {
      wx.showToast({ title: '请输入有效期望报酬', icon: 'none' })
      return
    }

    this.setData({ publishing: true })
    wx.showLoading({ title: '发布中...', mask: true })

    try {
      const body = {
        subjectRange: subjectRange.trim(),
        availableTime: availableTime.trim(),
        expectedFee: parseFloat(expectedFee)
      }

      await request({
        url: '/api/v1/proxy-class-supply/publish',
        method: 'POST',
        data: body
      })

      this.onPublishSuccess()
    } catch (err) {
      wx.hideLoading()
      console.error('发布代课供给失败:', err)
      wx.showToast({ title: err.message || '发布失败，请重试', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  },

  onPublishSuccess() {
    wx.hideLoading()
    wx.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => {
      safeNavigate({ url: '/pages/published/published?from=supply' })
    }, 1500)
  }
})
