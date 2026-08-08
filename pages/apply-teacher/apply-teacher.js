const { safeNavigate } = require('../../utils/safeNavigate')
const { request } = require('../../utils/request')

Page({
  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    teacherName: '',
    courseName: '',
    submitting: false
  },

  goBack() {
    wx.navigateBack()
  },

  onTeacherNameInput(e) {
    this.setData({ teacherName: e.detail.value })
  },

  onCourseNameInput(e) {
    this.setData({ courseName: e.detail.value })
  },

  async onSubmit() {
    const { teacherName, submitting } = this.data
    if (submitting) return
    if (!teacherName.trim()) {
      wx.showToast({ title: '请输入教师姓名', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })

    try {
      const body = { teacherName: teacherName.trim() }
      const courseName = this.data.courseName.trim()
      if (courseName) body.courseName = courseName

      await request({
        url: '/api/v1/teacher/apply',
        method: 'POST',
        data: body
      })

      wx.hideLoading()
      wx.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('提交申请失败:', err)
      wx.showToast({ title: err.message || '提交失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
