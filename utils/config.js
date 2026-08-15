/**
 * 后端地址配置。
 * - 开发版、体验版和正式版默认连接公网 HTTPS 后端。
 */
const PUBLIC_API_BASE_URL = 'https://xixutech.cn'
const ENV_BASE_URLS = {
  develop: PUBLIC_API_BASE_URL,
  trial: PUBLIC_API_BASE_URL,
  release: PUBLIC_API_BASE_URL
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

function getBaseUrl() {
  const envVersion = getEnvVersion()
  const configured = normalizeBaseUrl(ENV_BASE_URLS[envVersion])
  if (configured && envVersion !== 'develop' && !/^https:\/\//i.test(configured)) {
    throw new Error(`${envVersion} 环境后端地址必须使用 HTTPS`)
  }
  if (configured) return configured

  throw new Error(`${envVersion} 环境未配置后端地址`)
}

module.exports = {
  ENV_BASE_URLS,
  getBaseUrl
}
