const app = getApp()
const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    campusList: [],
    currentCampusId: null,
    selectedCampus: null,      // 弹窗中展示的待切换学校
    showConfirmModal: false,
    switching: false,
    switchResult: null,        // { success, remainingDays, message }
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
    this.fetchCampusList()
  },

  onShow() {
    // 从 select-major 返回后，检查是否已选择完专业
    const selectedMajor = wx.getStorageSync('selectedMajor')
    if (!selectedMajor) return

    try {
      const major = JSON.parse(selectedMajor)
      const schoolData = wx.getStorageSync('selectedSchool')
      if (!schoolData) return

      const school = JSON.parse(schoolData)
      // 清除 storage，避免重复触发
      wx.removeStorageSync('selectedMajor')
      wx.removeStorageSync('selectedSchool')

      // 调用后端接口切换学校
      this.doSwitchSchool(school, major)
    } catch (e) {
      console.error('解析切换学校数据失败:', e)
    }
  },

  /* 加载高校列表 */
  fetchCampusList() {
    const userInfo = app.globalData.userInfo || {}
    this.setData({ currentCampusId: userInfo.campusId || null })

    request({
      url: '/api/v1/campus/list',
      method: 'GET'
    }).then(list => {
      this.setData({ campusList: list || [] })
    }).catch(err => {
      console.error('获取高校列表失败:', err)
      wx.showToast({ title: '加载高校列表失败', icon: 'none' })
    })
  },

  /* 点击学校 → 弹出确认弹窗 */
  onTapCampus(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    if (!id) return

    // 不能切换到当前学校
    if (String(id) === String(this.data.currentCampusId)) {
      wx.showToast({ title: '你已在该学校', icon: 'none' })
      return
    }

    this.setData({
      selectedCampus: { id, name },
      showConfirmModal: true,
      switchResult: null
    })
  },

  /* 确认切换 → 跳转选择院系/专业 */
  onConfirmSwitch() {
    const campus = this.data.selectedCampus
    if (!campus) return

    this.setData({ showConfirmModal: false })

    // 存储学校信息，select-major 会从中读取 campusId
    wx.setStorageSync('selectedSchool', JSON.stringify(campus))

    wx.navigateTo({ url: '/pages/select-major/select-major' })
  },

  /* 取消切换 */
  onCancelModal() {
    this.setData({
      showConfirmModal: false,
      selectedCampus: null,
      switchResult: null
    })
  },

  /* 调用后端接口切换学校 */
  doSwitchSchool(school, major) {
    this.setData({ switching: true })

    request({
      url: '/api/v1/user/self-modify-school',
      method: 'PUT',
      data: {
        campusId: school.id,
        departmentId: major.departmentId,
        majorId: major.majorId
      }
    }).then(result => {
      // 成功
      this.setData({
        switching: false,
        switchResult: { success: true, message: '学校切换成功' }
      })

      // 刷新用户信息
      this.refreshUserInfo()

      wx.showToast({ title: '切换成功', icon: 'success' })
      setTimeout(() => { wx.navigateBack() }, 1500)
    }).catch(err => {
      this.setData({ switching: false })

      // 冷却期未到
      if (err && err.data && err.data.remainingDays !== undefined) {
        this.setData({
          switchResult: {
            success: false,
            remainingDays: err.data.remainingDays,
            message: err.data.message || ('修改冷却中，还需等待 ' + err.data.remainingDays + ' 天')
          }
        })
        wx.showToast({ title: '冷却中，剩余' + err.data.remainingDays + '天', icon: 'none', duration: 3000 })
      } else {
        console.error('切换学校失败:', err)
        wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' })
      }
    })
  },

  /* 刷新用户信息 */
  refreshUserInfo() {
    request({
      url: '/api/v1/user/me',
      method: 'GET'
    }).then(vo => {
      const userInfo = {
        uid: String(vo.userId),
        nickname: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '',
        phone: vo.phone || '',
        campusId: vo.campusId,
        school: vo.campusName || '',
        departmentId: vo.departmentId,
        department: vo.departmentName || '',
        majorId: vo.majorId,
        major: vo.majorName || '',
        enrollYear: vo.enrollmentYear || '',
        inviteCode: vo.inviteCode || '',
        invitedByUserId: vo.invitedByUserId,
        invitedBy: vo.invitedByUserName || null,
        nextModifyDays: vo.daysUntilNextModify,
        stats: { following: 0, followers: 0, likes: vo.likedCount || 0 }
      }
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
    }).catch(err => {
      console.error('刷新用户信息失败:', err)
    })
  },

  /* 阻止蒙层点击冒泡 */
  onSheetTap() {},

  /* 返回 */
  onBack() {
    wx.navigateBack()
  }
})
