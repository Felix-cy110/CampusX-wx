const { safeNavigate } = require('../../utils/safeNavigate')
const { request } = require('../../utils/request')
const { ensureSettlementAccountActive } = require('../../utils/settlementAccount')

Page({
  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
    setTimeout(() => this.guardErrandPublishing(), 0)
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 0,

    // 课程名称
    courseName: '',
    courseNameMax: 50,

    // 上课时间
    classDate: '',
    classTime: '',

    // 校区
    locationCampus: '',

    // 楼栋
    locationBuilding: '',

    // 教室号
    locationRoom: '',

    // 代课费
    fee: '',

    // 备注要求
    remark: '',
    remarkMax: 500,

    // 仅限本校接单
    onlySameSchool: true,

    publishing: false
  },

  goBack() {
    wx.navigateBack()
  },

  guardErrandPublishing() {
    return ensureSettlementAccountActive('/pages/publish-errand/publish-errand')
  },

  onCourseNameInput(e) {
    this.setData({ courseName: e.detail.value })
  },

  onDateChange(e) {
    this.setData({ classDate: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ classTime: e.detail.value })
  },

  onLocationCampusInput(e) {
    this.setData({ locationCampus: e.detail.value })
  },

  onLocationBuildingInput(e) {
    this.setData({ locationBuilding: e.detail.value })
  },

  onLocationRoomInput(e) {
    this.setData({ locationRoom: e.detail.value })
  },

  onFeeInput(e) {
    this.setData({ fee: e.detail.value })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  toggleOnlySameSchool() {
    this.setData({ onlySameSchool: !this.data.onlySameSchool })
  },

  /* 跳转发布代课供给 */
  goPublishSupply() {
    safeNavigate({ url: '/pages/publish-supply/publish-supply' })
  },

  // ===== 提交 =====

  async onSubmit() {
    if (this.data.publishing) return
    if (!(await this.guardErrandPublishing())) return

    const { courseName, classDate, classTime, locationCampus, locationBuilding, locationRoom, fee, remark, onlySameSchool } = this.data

    // 校验
    if (!courseName.trim()) {
      wx.showToast({ title: '请输入课程名称', icon: 'none' })
      return
    }
    if (!classDate) {
      wx.showToast({ title: '请选择上课日期', icon: 'none' })
      return
    }
    if (!classTime) {
      wx.showToast({ title: '请选择上课时间', icon: 'none' })
      return
    }
    if (!locationCampus.trim()) {
      wx.showToast({ title: '请输入校区', icon: 'none' })
      return
    }
    if (!locationBuilding.trim()) {
      wx.showToast({ title: '请输入楼栋', icon: 'none' })
      return
    }
    if (!locationRoom.trim()) {
      wx.showToast({ title: '请输入教室号', icon: 'none' })
      return
    }
    if (!fee || parseFloat(fee) <= 0) {
      wx.showToast({ title: '请输入有效代课费', icon: 'none' })
      return
    }

    this.setData({ publishing: true })
    wx.showLoading({ title: '发布中...', mask: true })

    try {
      // 拼接上课时间为后端 Jackson 期望格式：yyyy-MM-dd HH:mm:ss
      const classDateTime = classDate + ' ' + classTime + ':00'

      const body = {
        courseName: courseName.trim(),
        classTime: classDateTime,
        locationCampus: locationCampus.trim(),
        locationBuilding: locationBuilding.trim(),
        locationRoom: locationRoom.trim(),
        fee: parseFloat(fee),
        onlySameSchool: onlySameSchool ? 1 : 0
      }
      if (remark.trim()) {
        body.remark = remark.trim()
      }

      await request({
        url: '/api/v1/proxy-class-demand/publish',
        method: 'POST',
        data: body
      })

      this.onPublishSuccess()
    } catch (err) {
      wx.hideLoading()
      console.error('发布代课需求失败:', err)
      wx.showToast({ title: err.message || '发布失败，请重试', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  },

  onPublishSuccess() {
    wx.hideLoading()
    wx.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => {
      safeNavigate({ url: '/pages/published/published?from=errand' })
    }, 1500)
  }
})
