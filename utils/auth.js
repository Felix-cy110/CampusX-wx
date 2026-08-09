const AUTH_FAILURE_CODES = { 401: true, 1002: true, 1007: true }
const USER_INFO_INCOMPLETE = 1012
const ONBOARDING_ROUTES = {
  'pages/wechat-auth/wechat-auth': true,
  'pages/complete-info/complete-info': true,
  'pages/select-school/select-school': true,
  'pages/select-major/select-major': true
}

let navigating = false

function emptyUserInfo() {
  return {
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
  }
}

function resetGlobalSession() {
  const app = getApp()
  if (!app || !app.globalData) return
  app.globalData.isLoggedIn = false
  app.globalData.isJoinedSchool = false
  app.globalData.userInfo = emptyUserInfo()
  app.globalData.notificationCounts = {
    likes: 0,
    followers: 0,
    comments: 0,
    system: 0,
    chatUnread: 0
  }
  app.globalData._notificationCountsLoaded = false
  app.globalData._notificationReadSent = {
    likes: false,
    followers: false,
    comments: false,
    system: false
  }
  app.globalData._pendingChatDecrement = 0
}

function clearSession() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('tokenExpireTime')
  wx.removeStorageSync('userInfo')
  resetGlobalSession()
}

function storeToken(token, tokenExpireTime) {
  wx.setStorageSync('token', token)
  if (tokenExpireTime) {
    wx.setStorageSync('tokenExpireTime', tokenExpireTime)
  } else {
    wx.removeStorageSync('tokenExpireTime')
  }
}

function currentRoute() {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  return page ? page.route : ''
}

function canAccessCampusFeatures() {
  const app = getApp()
  return !!wx.getStorageSync('token') &&
    !!(app && app.globalData && app.globalData.isJoinedSchool)
}

function navigateOnce(url, message) {
  if (navigating || currentRoute() === url.replace(/^\//, '')) return
  navigating = true
  wx.reLaunch({
    url,
    complete: () => {
      if (message) wx.showToast({ title: message, icon: 'none' })
    }
  })
}

function redirectToLogin(message) {
  clearSession()
  navigateOnce('/pages/login/login', message || '登录已失效，请重新登录')
}

function redirectToCompleteInfo(message) {
  const app = getApp()
  if (app && app.globalData) app.globalData.isJoinedSchool = false
  // 授权和资料完善页面本身就是 onboarding 流程。此时收到后台请求的 1012
  // 不能 reLaunch，否则会打断选择学校/专业的 navigateTo，造成白屏或页面回退。
  if (ONBOARDING_ROUTES[currentRoute()]) return
  navigateOnce('/pages/complete-info/complete-info', message || '请先完善用户信息')
}

function handleAuthFailure(error, tokenSnapshot) {
  const code = Number(error && (error.code || error.statusCode))
  const hasTokenSnapshot = arguments.length >= 2
  const currentToken = wx.getStorageSync('token')
  // 只有请求发出时确实携带了 Token，才允许认证失败触发全局跳转。
  // 登录前的受保护接口请求返回 401 时，应交给调用方处理，不能把它误判为会话过期。
  const requestHadToken = hasTokenSnapshot ? !!tokenSnapshot : !!currentToken
  const belongsToCurrentSession = !hasTokenSnapshot || currentToken === tokenSnapshot
  const shouldRedirect = requestHadToken && belongsToCurrentSession
  if (code === USER_INFO_INCOMPLETE) {
    if (shouldRedirect) {
      redirectToCompleteInfo(error && error.message)
    }
    return true
  }
  if (AUTH_FAILURE_CODES[code]) {
    if (shouldRedirect) {
      redirectToLogin(error && error.message)
    }
    return true
  }
  return false
}

function resetAuthNavigation() {
  navigating = false
}

module.exports = {
  clearSession,
  storeToken,
  redirectToLogin,
  canAccessCampusFeatures,
  handleAuthFailure,
  resetAuthNavigation
}
