const app = getApp()
const { request, toFullUrl } = require('../../utils/request')
const { storeToken, resetAuthNavigation, resumeAfterAuth, discardPendingSelectionTarget } = require('../../utils/auth')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    isLoggingIn: false
  },
  onLoad() {
    resetAuthNavigation()
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
  },
  wechatLogin() {
    if (this._loggingIn) return
    this._loggingIn = true
    this.setData({ isLoggingIn: true })
    wx.showLoading({ title: '微信登录中...', mask: true })

    wx.login({
      timeout: 10000,
      success: (loginRes) => {
        if (!loginRes.code) {
          this.finishLoginLoading()
          wx.showToast({ title: '未获取到微信登录凭证，请重试', icon: 'none' })
          return
        }

        request({
          url: '/api/v1/user/login/wechat',
          method: 'POST',
          data: { code: loginRes.code }
        }).then(vo => {
          storeToken(vo.token, vo.tokenExpireTime)

          // 新用户的服务端占位昵称不应冒充微信昵称，交给微信昵称填写能力获取。
          const nickname = vo.nickname && vo.nickname !== '微信用户' ? vo.nickname : ''
          const userInfo = {
            uid: String(vo.userId || ''),
            nickname,
            avatar: toFullUrl(vo.avatarUrl) || '',
            phone: '',
            campusId: vo.campusId || null,
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
          }

          wx.setStorageSync('userInfo', userInfo)
          app.globalData.isLoggedIn = true
          app.globalData.isJoinedSchool = !!vo.campusId
          app.globalData.userInfo = userInfo
          this.finishLoginLoading()

          if (vo.isNewUser || !vo.campusId) {
            // 新用户会在完善资料流程里选择学校，无需登录后再次进入学校选择页。
            discardPendingSelectionTarget()
            wx.redirectTo({ url: '/pages/complete-info/complete-info' })
          } else {
            resumeAfterAuth()
          }
        }).catch(err => {
          this.finishLoginLoading()
          console.error('微信登录失败:', err)
          wx.showToast({ title: (err && err.message) || '微信登录失败，请重试', icon: 'none' })
        })
      },
      fail: (err) => {
        this.finishLoginLoading()
        console.error('wx.login 失败:', err)
        wx.showToast({ title: '微信登录失败，请检查网络后重试', icon: 'none' })
      }
    })
  },

  finishLoginLoading() {
    this._loggingIn = false
    wx.hideLoading()
    this.setData({ isLoggingIn: false })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
