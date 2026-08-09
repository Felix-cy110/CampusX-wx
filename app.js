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
      this.validateStoredSession(token)
    } else if (userInfo) {
      // 清理旧版本可能遗留的孤立用户缓存
      wx.removeStorageSync('userInfo')
    }
  },

  validateStoredSession(tokenSnapshot) {
    const { request, toFullUrl } = require('./utils/request')
    request({ url: '/api/v1/user/me', method: 'GET' }).then(vo => {
      // 校验期间若用户已退出或重新登录，不用旧请求覆盖新会话
      if (wx.getStorageSync('token') !== tokenSnapshot) return
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
    }).catch(err => {
      // 认证类错误由 request 统一清理并跳转；网络错误保留本地会话，待下次请求重试
      console.warn('启动会话校验失败:', err)
    })
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

    // 跨校发帖额度
    crossSchoolQuota: 5,

    // 收件箱通知数量缓存（各子页面进入时立即清零，用于 tabBar badge 即时更新）
    notificationCounts: {
      likes: 0,
      followers: 0,
      comments: 0,
      system: 0,
      chatUnread: 0
    },

    // 标记 notificationCounts 是否已被 API 填充过（防止首次加载时用初始零值覆盖 badge）
    _notificationCountsLoaded: false,

    // 乐观更新追踪：记录本地已标记已读但后端可能尚未确认的类型和数量
    _notificationReadSent: {
      likes: false,
      followers: false,
      comments: false,
      system: false
    },
    _pendingChatDecrement: 0
  }
})
