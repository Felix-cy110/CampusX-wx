const { request, BASE_URL, toFullUrl } = require('../../utils/request')
const { safeSwitch } = require('../../utils/safeNavigate')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    avatar: '',            // 本地临时路径
    avatarUrl: '',         // 上传后的服务器 URL
    nickname: '',
    enrollmentYear: '',
    enrollmentYearIndex: -1,
    enrollmentYears: [],
    schoolId: null,
    schoolName: '',
    majorId: null,
    majorName: '',
    departmentId: null,
    departmentName: '',
    phone: '',
    canSubmit: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    // 初始化入学年份选项（近11年）
    const currentYear = new Date().getFullYear()
    const enrollmentYears = []
    for (let y = currentYear; y >= currentYear - 10; y--) {
      enrollmentYears.push(y + '年')
    }

    this.setData({ statusBarHeight, navBarHeight, enrollmentYears })
  },

  onShow() {
    // 从 storage 读取选择的高校
    const selectedSchool = wx.getStorageSync('selectedSchool')
    if (selectedSchool) {
      try {
        const school = JSON.parse(selectedSchool)
        this.setData({ schoolId: school.id, schoolName: school.name })
        wx.removeStorageSync('selectedSchool')
      } catch (e) {
        console.error('解析学校数据失败:', e)
      }
    }

    // 从 storage 读取选择的专业
    const selectedMajor = wx.getStorageSync('selectedMajor')
    if (selectedMajor) {
      try {
        const major = JSON.parse(selectedMajor)
        this.setData({
          departmentId: major.departmentId,
          departmentName: major.departmentName,
          majorId: major.majorId,
          majorName: major.majorName
        })
        wx.removeStorageSync('selectedMajor')
      } catch (e) {
        console.error('解析专业数据失败:', e)
      }
    }

    this.checkCanSubmit()
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { schoolId, majorId } = this.data
    const canSubmit = !!(schoolId && majorId)
    this.setData({ canSubmit })
  },

  // 返回
  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 上传头像
  uploadAvatar() {
    const that = this
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        that.setData({ avatar: tempFilePath })

        // 上传到服务器
        wx.showLoading({ title: '上传中...' })
        wx.uploadFile({
          url: BASE_URL + '/api/v1/upload/image',
          filePath: tempFilePath,
          name: 'file',
          header: {
            Authorization: 'Bearer ' + (wx.getStorageSync('token') || '')
          },
          success: (uploadRes) => {
            wx.hideLoading()
            try {
              const result = JSON.parse(uploadRes.data)
              if (result.code === 200 && result.data && result.data.url) {
                that.setData({ avatarUrl: result.data.url })
              } else {
                wx.showToast({ title: (result && result.message) || '上传失败', icon: 'none' })
              }
            } catch (e) {
              wx.showToast({ title: '上传失败', icon: 'none' })
            }
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '上传失败', icon: 'none' })
          }
        })
      }
    })
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  // 选择入学年份
  onEnrollmentYearChange(e) {
    const index = e.detail.value
    const yearStr = this.data.enrollmentYears[index]
    const year = parseInt(yearStr)
    this.setData({ enrollmentYear: year, enrollmentYearIndex: index })
  },

  // 跳转选择学校
  selectSchool() {
    wx.navigateTo({ url: '/pages/select-school/select-school' })
  },

  // 跳转选择专业
  selectMajor() {
    if (!this.data.schoolId) {
      wx.showToast({ title: '请先选择高校', icon: 'none' })
      return
    }
    // 将当前已选学校写入 storage，供 select-major 页面读取
    wx.setStorageSync('selectedSchool', JSON.stringify({
      id: this.data.schoolId,
      name: this.data.schoolName
    }))
    wx.navigateTo({ url: '/pages/select-major/select-major' })
  },

  // 手机号输入
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  // 提交
  submit() {
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请先选择高校和专业', icon: 'none' })
      return
    }

    const { avatarUrl, nickname, phone, schoolId, schoolName, departmentId, departmentName, majorId, majorName, enrollmentYear } = this.data

    wx.showLoading({ title: '提交中...' })
    request({
      url: '/api/v1/user/complete-info',
      method: 'POST',
      data: {
        nickname: nickname || '微信用户',
        avatarUrl: avatarUrl || '',
        phone: phone || '',
        campusId: schoolId,
        departmentId: departmentId,
        majorId: majorId,
        enrollmentYear: enrollmentYear || new Date().getFullYear()
      }
    }).then(vo => {
      wx.hideLoading()
      wx.showToast({ title: '完善成功', icon: 'success' })

      // 更新 JWT token（包含最新的 campusId）
      if (vo && vo.token) {
        wx.setStorageSync('token', vo.token)
      }

      // 更新全局用户信息
      const app = getApp()
      app.globalData.isJoinedSchool = true
      // 刷新用户信息
      request({
        url: '/api/v1/user/me',
        method: 'GET'
      }).then(userVO => {
        const userInfo = mapUserInfo(userVO)
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)
      }).catch(() => {})

      // 跳转到主页
      setTimeout(() => {
        safeSwitch({ url: '/pages/index/index' })
      }, 1000)
    }).catch(err => {
      // mock 阶段：后端未就绪时模拟成功，保证流程可通
      console.log('完善信息 API 失败（mock 阶段）:', err)
      wx.hideLoading()
      wx.showToast({ title: '完善成功', icon: 'success' })

      const app = getApp()
      app.globalData.isJoinedSchool = true
      const userInfo = {
        uid: 'mock_user_' + Date.now(),
        nickname: nickname || '微信用户',
        avatar: avatarUrl || '/images/avatars/default.png',
        phone: phone || '',
        campusId: schoolId,
        school: schoolName,
        departmentId: departmentId,
        department: departmentName,
        majorId: majorId,
        major: majorName,
        enrollYear: enrollmentYear || new Date().getFullYear(),
        inviteCode: '',
        invitedByUserId: null,
        invitedBy: null,
        nextModifyDays: 30,
        stats: { following: 0, followers: 0, likes: 0 }
      }
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)

      setTimeout(() => {
        safeSwitch({ url: '/pages/index/index' })
      }, 1000)
    })
  }
})

/**
 * 将后端 UserInfoVO 映射为前端展示格式
 */
function mapUserInfo(vo) {
  return {
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
}
