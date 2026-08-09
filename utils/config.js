/**
 * 后端地址配置。
 * - 开发者工具默认连接本机 5659 端口。
 * - 真机调试可通过 campusxApiBaseUrl 本地存储覆盖为电脑局域网地址。
 * - 体验版和正式版发布前必须配置已加入微信合法域名的 HTTPS 地址。
 */
const API_BASE_URL_STORAGE_KEY = 'campusxApiBaseUrl'
const ENV_BASE_URLS = {
  develop: 'http://localhost:5659',
  trial: '',
  release: ''
}

function normalizeBaseUrl(value) {
  const url = String(value || '').trim().replace(/\/+$/, '')
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('后端地址必须以 http:// 或 https:// 开头')
  }
  return url
}

function getEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    return accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion || 'develop'
  } catch (e) {
    return 'develop'
  }
}

function isDevtools() {
  try {
    const deviceInfo = typeof wx.getDeviceInfo === 'function'
      ? wx.getDeviceInfo()
      : wx.getSystemInfoSync()
    return deviceInfo.platform === 'devtools'
  } catch (e) {
    return false
  }
}

function getBaseUrl() {
  const envVersion = getEnvVersion()
  if (envVersion === 'develop') {
    const override = normalizeBaseUrl(wx.getStorageSync(API_BASE_URL_STORAGE_KEY))
    if (override) return override
  }

  const configured = normalizeBaseUrl(ENV_BASE_URLS[envVersion])
  if (configured && envVersion !== 'develop' && !/^https:\/\//i.test(configured)) {
    throw new Error(`${envVersion} 环境后端地址必须使用 HTTPS`)
  }
  if (configured && (envVersion !== 'develop' || isDevtools())) return configured

  if (envVersion === 'develop') {
    throw new Error('真机调试未配置后端地址，请设置 campusxApiBaseUrl 为电脑局域网地址')
  }
  throw new Error(`${envVersion} 环境未配置后端 HTTPS 地址`)
}

function setBaseUrl(value) {
  const url = normalizeBaseUrl(value)
  if (!url) throw new Error('后端地址不能为空')
  wx.setStorageSync(API_BASE_URL_STORAGE_KEY, url)
  return url
}

function clearBaseUrlOverride() {
  wx.removeStorageSync(API_BASE_URL_STORAGE_KEY)
}

module.exports = {
  API_BASE_URL_STORAGE_KEY,
  ENV_BASE_URLS,
  getBaseUrl,
  setBaseUrl,
  clearBaseUrlOverride
}
