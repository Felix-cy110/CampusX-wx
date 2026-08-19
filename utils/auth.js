const AUTH_FAILURE_CODES = { 401: true, 1002: true, 1007: true }
const USER_INFO_INCOMPLETE = 1012
const PENDING_AUTH_TARGET_KEY = 'pendingAuthTarget'
const PUBLIC_ROUTES = {
  'pages/index/index': true,
  'pages/login/login': true,
  'pages/wechat-auth/wechat-auth': true
}
const ONBOARDING_ROUTES = {
  'pages/wechat-auth/wechat-auth': true,
  'pages/complete-info/complete-info': true,
  'pages/select-school/select-school': true,
  'pages/select-major/select-major': true
}
const TAB_ROUTES = {
  'pages/index/index': true,
  'pages/explore/explore': true,
  'pages/inbox/inbox': true,
  'pages/profile/profile': true
}

let navigating = false
let authGateNavigating = false

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

function normalizeRoute(url) {
  return String(url || '').replace(/^\//, '').split('?')[0]
}

function appendQuery(path, query) {
  const entries = Object.keys(query || {})
    .filter(key => query[key] !== undefined && query[key] !== null)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(String(query[key])))
  return '/' + normalizeRoute(path) + (entries.length ? '?' + entries.join('&') : '')
}

function isPublicRoute(url) {
  return !!PUBLIC_ROUTES[normalizeRoute(url)]
}

function isOnboardingRoute(url) {
  return !!ONBOARDING_ROUTES[normalizeRoute(url)]
}

function savePendingAuthTarget(url) {
  const route = normalizeRoute(url)
  if (!route || PUBLIC_ROUTES[route] || route === 'pages/complete-info/complete-info') return
  wx.setStorageSync(PENDING_AUTH_TARGET_KEY, {
    url: String(url).charAt(0) === '/' ? String(url) : '/' + String(url),
    createdAt: Date.now()
  })
}

function takePendingAuthTarget() {
  const target = wx.getStorageSync(PENDING_AUTH_TARGET_KEY)
  wx.removeStorageSync(PENDING_AUTH_TARGET_KEY)
  if (!target || typeof target.url !== 'string') return null
  if (!/^\/pages\//.test(target.url)) return null
  // 防止很久以前中断的登录动作影响之后的正常启动。
  if (target.createdAt && Date.now() - Number(target.createdAt) > 30 * 60 * 1000) return null
  return target
}

function getPendingInviteCode() {
  const target = wx.getStorageSync(PENDING_AUTH_TARGET_KEY)
  const url = target && target.url
  if (typeof url !== 'string') return ''
  const match = url.match(/[?&]inviteCode=([^&#]*)/)
  if (!match) return ''
  try {
    return decodeURIComponent(match[1]).trim()
  } catch (e) {
    return ''
  }
}

function discardPendingSelectionTarget() {
  const target = wx.getStorageSync(PENDING_AUTH_TARGET_KEY)
  const route = target && normalizeRoute(target.url)
  if (route === 'pages/select-school/select-school' || route === 'pages/select-major/select-major') {
    wx.removeStorageSync(PENDING_AUTH_TARGET_KEY)
  }
}

function openAuthGate(url, navigationMode, message) {
  const route = normalizeRoute(url)
  if (authGateNavigating || currentRoute() === route) return
  authGateNavigating = true
  const method = navigationMode === 'reLaunch' ? 'reLaunch' : 'navigateTo'
  wx[method]({
    url,
    complete: () => {
      authGateNavigating = false
      if (message) wx.showToast({ title: message, icon: 'none' })
    }
  })
}

/**
 * 统一登录守卫。默认要求“已登录且已完善校园资料”。
 * targetUrl 用于登录成功后恢复用户原本想去的页面。
 */
function requireAuth(options) {
  const config = options || {}
  const targetUrl = config.targetUrl || ''
  const requireCampus = config.requireCampus !== false
  const token = wx.getStorageSync('token')
  const app = getApp()

  if (!token) {
    savePendingAuthTarget(targetUrl)
    openAuthGate('/pages/login/login', config.navigationMode, config.message)
    return false
  }

  const joinedSchool = !!(app && app.globalData && app.globalData.isJoinedSchool)
  if (requireCampus && !joinedSchool) {
    savePendingAuthTarget(targetUrl)
    openAuthGate('/pages/complete-info/complete-info', config.navigationMode, '请先完善用户信息')
    return false
  }
  return true
}

/** 根据目标页面自动判断权限级别，供所有统一导航方法调用。 */
function guardNavigation(url, navigationMode) {
  if (!url || isPublicRoute(url)) return true
  return requireAuth({
    targetUrl: url,
    requireCampus: !isOnboardingRoute(url),
    navigationMode
  })
}

/**
 * 处理扫码、分享卡片或历史入口直接打开受保护页面的场景。
 * 启动阶段只检查登录；资料完整性随后由页面请求的 1012 统一处理。
 */
function guardAppEntry(launchOptions) {
  const options = launchOptions || {}
  const path = options.path || ''
  if (!path || isPublicRoute(path)) return true
  const targetUrl = appendQuery(path, options.query)
  return requireAuth({
    targetUrl,
    requireCampus: false,
    navigationMode: 'reLaunch'
  })
}

/** 登录或资料完善成功后，回到用户触发登录前的目标页面。 */
function resumeAfterAuth(fallbackUrl) {
  const fallback = fallbackUrl || '/pages/index/index'
  const target = takePendingAuthTarget()
  let url = target ? target.url : fallback
  let route = normalizeRoute(url)

  // 登录页和资料完善页已经完成使命，不再重复进入。
  if (!route || route === 'pages/wechat-auth/wechat-auth' || route === 'pages/complete-info/complete-info') {
    url = fallback
    route = normalizeRoute(url)
  }

  const onFailure = () => {
    if (normalizeRoute(fallback) === route) return
    wx.switchTab({ url: fallback })
  }
  if (TAB_ROUTES[route]) {
    wx.switchTab({ url, fail: onFailure })
  } else {
    wx.redirectTo({ url, fail: onFailure })
  }
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
  authGateNavigating = false
}

module.exports = {
  clearSession,
  storeToken,
  redirectToLogin,
  canAccessCampusFeatures,
  requireAuth,
  guardNavigation,
  guardAppEntry,
  resumeAfterAuth,
  getPendingInviteCode,
  discardPendingSelectionTarget,
  handleAuthFailure,
  resetAuthNavigation
}
