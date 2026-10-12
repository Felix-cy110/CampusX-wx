App({
  onLaunch() {
    const token = wx.getStorageSync('token')
    const tokenExpireTime = Number(wx.getStorageSync('tokenExpireTime') || 0)
    const userInfo = wx.getStorageSync('userInfo')
    if (token && tokenExpireTime && tokenExpireTime <= Date.now()) {
      const { clearSession } = require('./utils/auth')
      clearSession()
      return
    }
    if (token) {
      this.globalData.isLoggedIn = true
      if (userInfo) {
        this.globalData.userInfo = userInfo
        this.globalData.isJoinedSchool = !!(userInfo.campusId || userInfo.school)
      }
      this.sessionReady = this.validateStoredSession(token)
    } else if (userInfo) {
      // 清理旧版本可能遗留的孤立用户缓存
      wx.removeStorageSync('userInfo')
    }
  },

  onShow(options) {
    const { guardAppEntry } = require('./utils/auth')
    guardAppEntry(options)
  },

  validateStoredSession(tokenSnapshot) {
    const current = this.sessionValidation
    if (current && current.token === tokenSnapshot && current.status === 'pending') {
      return current.promise
    }
    const validation = { token: tokenSnapshot, status: 'pending' }
    this.sessionValidation = validation
    const { request, toFullUrl } = require('./utils/request')
    validation.promise = request({ url: '/api/v1/user/me', method: 'GET' }).then(vo => {
      // 校验期间若用户已退出或重新登录，不用旧请求覆盖新会话
      if (wx.getStorageSync('token') !== tokenSnapshot || this.sessionValidation !== validation) return false
      const cached = wx.getStorageSync('userInfo') || {}
      const userInfo = Object.assign({}, cached, {
        uid: String(vo.userId),
        nickname: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '',
        phone: vo.phone || '',
        campusId: vo.campusId || null,
        school: vo.campusName || '',
        departmentId: vo.departmentId || null,
        department: vo.departmentName || '',
        majorId: vo.majorId || null,
        major: vo.majorName || '',
        enrollYear: vo.enrollmentYear || ''
      })
      this.globalData.isLoggedIn = true
      this.globalData.isJoinedSchool = !!vo.campusId
      this.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
      validation.status = 'ready'
      return true
    }).catch(err => {
      // 保留缓存供页面展示，但失败不代表学校已确认；首页下拉刷新会重新校验。
      validation.status = 'failed'
      console.warn('启动会话校验失败:', err)
      return false
    })
    this.sessionReady = validation.promise
    return validation.promise
  },

  globalData: {
    // 用户登录状态
    isLoggedIn: false,
    isJoinedSchool: false,

    // 当前用户信息（字段名与后端 VO 映射后的格式对齐）
    userInfo: {
      uid: '',
      nickname: '',
      avatar: '',
      phone: '',
      campusId: null,
      school: '',
      departmentId: null,
      department: '',
      majorId: null,
      major: '',
      enrollYear: '',
      inviteCode: '',
      invitedByUserId: null,
      invitedBy: null,
      nextModifyDays: null,
      stats: { following: 0, followers: 0, likes: 0 }
    },

    // 发布完成后通知首页刷新内容，最新版本的列表刷新成功后确认。
    homeContentNeedsRefresh: false,
    homeContentRefreshVersion: 0,

    // 跨校发帖额度
    crossSchoolQuota: 5,

    // 收件箱通知数量缓存；读写统一由 utils/unread.js 协调。
    notificationCounts: {
      likes: 0,
      followers: 0,
      comments: 0,
      system: 0,
      chatUnread: 0
    },

    // 标记 notificationCounts 是否已被 API 填充过（防止首次加载时用初始零值覆盖 badge）
    _notificationCountsLoaded: false
  }
})
