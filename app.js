App({
  onLaunch() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    if (token) {
      this.globalData.isLoggedIn = true
      if (userInfo) {
        this.globalData.userInfo = userInfo
        this.globalData.isJoinedSchool = !!(userInfo.campusId || userInfo.school)
      }
    }
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
