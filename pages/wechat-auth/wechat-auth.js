const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    phoneNumber: '18682000000',
    appName: 'CampusX'
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: systemInfo.statusBarHeight })
  },

  // 允许授权
  allow() {
    wx.showLoading({ title: '授权中...' })
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.hideLoading()
          wx.showToast({ title: '获取登录凭证失败', icon: 'none' })
          return
        }
        request({
          url: '/api/v1/user/login/wechat',
          method: 'POST',
          data: { code: loginRes.code }
        }).then(vo => {
          wx.hideLoading()
          // 存储 token
          wx.setStorageSync('token', vo.token)

          // 构造与前端模板兼容的用户信息对象
          const userInfo = {
            uid: String(vo.userId),
            nickname: vo.nickname || '',
            avatar: toFullUrl(vo.avatarUrl) || '',
            campusId: vo.campusId || null,
            school: '',
            department: '',
            major: '',
            enrollYear: '',
            phone: '',
            inviteCode: '',
            invitedBy: null,
            nextModifyDays: null,
            stats: { following: 0, followers: 0, likes: 0 }
          }
          wx.setStorageSync('userInfo', userInfo)

          const app = getApp()
          app.globalData.isLoggedIn = true
          app.globalData.userInfo = userInfo
          app.globalData.isJoinedSchool = !!vo.campusId

          wx.showToast({ title: '授权成功', icon: 'success' })
          setTimeout(() => {
            if (vo.isNewUser || !vo.campusId) {
              // 新用户或未绑定学校，引导完善信息
              safeNavigate({ url: '/pages/complete-info/complete-info' })
            } else {
              wx.switchTab({ url: '/pages/index/index' })
            }
          }, 800)
        }).catch(err => {
          wx.hideLoading()
          console.error('登录失败:', err)
          wx.showToast({ title: (err && err.message) || '登录失败', icon: 'none' })
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '微信登录失败', icon: 'none' })
      }
    })
  },

  // 拒绝授权
  deny() {
    wx.showModal({
      title: '提示',
      content: '拒绝授权后部分功能将无法使用',
      confirmText: '仍要拒绝',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack({ delta: 1 })
        }
      }
    })
  },

  // 使用其他手机号
  useOtherPhone() {
    wx.showModal({
      title: '使用其他手机号',
      content: '请输入其他手机号码',
      editable: true,
      placeholderText: '请输入手机号',
      success: (res) => {
        if (res.confirm && res.content) {
          const phone = res.content.trim()
          if (/^1\d{10}$/.test(phone)) {
            this.setData({ phoneNumber: phone })
            wx.showToast({ title: '手机号已更新', icon: 'success' })
          } else {
            wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
          }
        }
      }
    })
  }
})
