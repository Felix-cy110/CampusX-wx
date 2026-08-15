const app = getApp()
const { request, getBaseUrl, toFullUrl } = require('../../utils/request')
const { storeToken, handleAuthFailure } = require('../../utils/auth')

Page({
  data: {
    avatar: '',              // 显示用的头像 URL
    avatarTempPath: '',      // 本地临时路径（新选择的头像）
    avatarChanged: false,    // 头像是否变更
    userId: '',
    nickname: '',
    enrollmentYear: '',
    schoolId: null,
    school: '',
    majorId: null,
    major: '',
    departmentId: null,
    department: '',
    schoolChanged: false,    // 学校/专业是否变更
    phone: '',
    years: [],
    yearIndex: 0,
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

    const currentYear = new Date().getFullYear()
    const years = []
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(String(y))
    }

    // 先从全局数据读取显示，同时请求最新数据
    const cached = app.globalData.userInfo || {}
    const enrollmentYear = cached.enrollYear || ''
    const yearIndex = years.indexOf(String(enrollmentYear))

    this.setData({
      years,
      yearIndex: yearIndex >= 0 ? yearIndex : 0,
      avatar: cached.avatar || '',
      nickname: cached.nickname || '',
      userId: cached.uid || '',
      enrollmentYear: enrollmentYear,
      schoolId: cached.campusId || null,
      school: cached.school || '',
      majorId: cached.majorId || null,
      major: cached.major || '',
      departmentId: cached.departmentId || null,
      department: cached.department || '',
      phone: cached.phone || ''
    })

    // 从后端获取最新数据
    this.fetchUserInfo()
  },

  onShow() {
    // 从 storage 读取选择高校的结果
    const selectedSchool = wx.getStorageSync('selectedSchool')
    if (selectedSchool) {
      try {
        const school = JSON.parse(selectedSchool)
        if (school.source !== 'edit-profile-major') {
          const schoolChanged = this.data.schoolId &&
            String(this.data.schoolId) !== String(school.id)
          this.setData({
            schoolId: school.id,
            school: school.name,
            schoolChanged: this.data.schoolChanged || !!schoolChanged,
            ...(schoolChanged ? {
              departmentId: null,
              department: '',
              majorId: null,
              major: ''
            } : {})
          })
        }
        wx.removeStorageSync('selectedSchool')
      } catch (e) {
        console.error('解析学校数据失败:', e)
      }
    }

    // 从 storage 读取选择专业的结果
    const selectedMajor = wx.getStorageSync('selectedMajor')
    if (selectedMajor) {
      try {
        const major = JSON.parse(selectedMajor)
        const majorChanged = String(this.data.departmentId || '') !== String(major.departmentId || '') ||
          String(this.data.majorId || '') !== String(major.majorId || '')
        this.setData({
          departmentId: major.departmentId,
          department: major.departmentName,
          majorId: major.majorId,
          major: major.majorName,
          schoolChanged: this.data.schoolChanged || majorChanged
        })
        wx.removeStorageSync('selectedMajor')
      } catch (e) {
        console.error('解析专业数据失败:', e)
      }
    }
  },

  // 从后端获取最新用户信息
  fetchUserInfo() {
    request({
      url: '/api/v1/user/me',
      method: 'GET'
    }).then(vo => {
      const years = this.data.years
      const enrollmentYear = vo.enrollmentYear || ''
      const yearIndex = years.indexOf(String(enrollmentYear))

      this.setData({
        avatar: toFullUrl(vo.avatarUrl) || '',
        nickname: vo.nickname || '',
        userId: String(vo.userId),
        enrollmentYear: enrollmentYear || '',
        yearIndex: yearIndex >= 0 ? yearIndex : 0,
        schoolId: vo.campusId,
        school: vo.campusName || '',
        majorId: vo.majorId,
        major: vo.majorName || '',
        departmentId: vo.departmentId,
        department: vo.departmentName || '',
        phone: vo.phone || ''
      })
    }).catch(err => {
      console.error('获取用户信息失败:', err)
    })
  },

  onBack() { wx.navigateBack() },

  // 微信头像填写能力：可选择当前微信头像或相册图片。
  onChooseAvatar(e) {
    const tempFilePath = e && e.detail && e.detail.avatarUrl
    if (!tempFilePath) {
      wx.showToast({ title: '未选择头像', icon: 'none' })
      return
    }
    this.setData({
      avatar: tempFilePath,
      avatarTempPath: tempFilePath,
      avatarChanged: true
    })
  },

  onInputNickname(e) {
    this.setData({ nickname: e.detail.value })
  },

  onSelectYear(e) {
    const index = e.detail.value
    this.setData({
      yearIndex: index,
      enrollmentYear: this.data.years[index]
    })
  },

  onSelectSchool() {
    wx.navigateTo({ url: '/pages/select-school/select-school' })
  },

  onSelectMajor() {
    if (!this.data.schoolId) {
      wx.showToast({ title: '请先选择高校', icon: 'none' })
      return
    }
    wx.setStorageSync('selectedSchool', JSON.stringify({
      id: this.data.schoolId,
      name: this.data.school,
      source: 'edit-profile-major'
    }))
    wx.navigateTo({ url: '/pages/select-major/select-major' })
  },

  onInputPhone(e) {
    this.setData({ phone: e.detail.value })
  },

  onSave() {
    if (this._saving) return
    const { avatarChanged, avatarTempPath, avatar, nickname, enrollmentYear,
            schoolId, departmentId, majorId, schoolChanged, phone } = this.data

    if (schoolChanged && (!schoolId || !departmentId || !majorId)) {
      wx.showToast({ title: '请选择新高校对应的院系和专业', icon: 'none' })
      return
    }

    this._saving = true
    wx.showLoading({ title: '保存中...' })

    // 头像上传或直接保存
    const doSave = (avatarUrl) => {
      // 保存基本信息
      const savePromise = request({
        url: '/api/v1/user/info',
        method: 'PUT',
        data: {
          nickname: nickname || '微信用户',
          avatarUrl: avatarUrl || avatar || '',
          phone: phone || undefined,
          enrollmentYear: enrollmentYear ? Number(enrollmentYear) : undefined
        }
      })

      return savePromise
    }

    const saveAll = (avatarUrl) => {
      return doSave(avatarUrl).then(() => {
        // 如果学校/专业变更了，调用自助修改接口
        if (schoolChanged) {
          return request({
            url: '/api/v1/user/self-modify-school',
            method: 'PUT',
            data: {
              campusId: schoolId,
              departmentId: departmentId,
              majorId: majorId
            }
          })
        }
      }).then((selfModifyResult) => {
        if (selfModifyResult && selfModifyResult.success === false) {
          const error = new Error(selfModifyResult.message || '学校修改冷却中')
          error.remainingDays = selfModifyResult.remainingDays
          error.basicInfoSaved = true
          throw error
        }
        if (schoolChanged && (!selfModifyResult || !selfModifyResult.token)) {
          throw new Error('学校修改结果异常，请刷新后重试')
        }
        // 如果学校变更了，更新 JWT token（包含最新的 campusId）
        if (selfModifyResult && selfModifyResult.token) {
          storeToken(selfModifyResult.token, selfModifyResult.tokenExpireTime)
        }
        // 刷新用户信息
        return request({
          url: '/api/v1/user/me',
          method: 'GET'
        })
      }).then(vo => {
        wx.hideLoading()
        this._saving = false
        // 更新全局数据
        const userInfo = mapUserInfo(vo)
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)

        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => { wx.navigateBack() }, 1500)
      }).catch(err => {
        wx.hideLoading()
        this._saving = false
        console.error('保存失败:', err)
        if (err && err.remainingDays !== undefined) {
          this.setData({ schoolChanged: false })
          this.fetchUserInfo()
          wx.showModal({
            title: '学校修改未完成',
            content: (err.basicInfoSaved ? '基本资料已保存；' : '') +
              (err.message || ('学校修改冷却中，还剩' + err.remainingDays + '天')),
            showCancel: false
          })
        } else {
          wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
        }
      })
    }

    // 如果头像变更了，先上传
    if (avatarChanged && avatarTempPath) {
      const tokenSnapshot = wx.getStorageSync('token') || ''
      wx.uploadFile({
        url: getBaseUrl() + '/api/v1/upload/image',
        filePath: avatarTempPath,
        name: 'file',
        header: {
          Authorization: 'Bearer ' + tokenSnapshot
        },
        success: (uploadRes) => {
          try {
            const result = JSON.parse(uploadRes.data)
            if (result.code === 200 && result.data && result.data.url) {
              saveAll(result.data.url)
            } else {
              wx.hideLoading()
              this._saving = false
              if (!handleAuthFailure(result, tokenSnapshot)) {
                wx.showToast({ title: result.message || '头像上传失败', icon: 'none' })
              }
            }
          } catch (e) {
            wx.hideLoading()
            this._saving = false
            wx.showToast({ title: '头像上传失败', icon: 'none' })
          }
        },
        fail: () => {
          wx.hideLoading()
          this._saving = false
          wx.showToast({ title: '头像上传失败', icon: 'none' })
        }
      })
    } else {
      saveAll(avatar)
    }
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
