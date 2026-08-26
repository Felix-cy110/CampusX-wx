const { request } = require('./request')
const { safeNavigate } = require('./safeNavigate')

const RETURN_URL_KEY = 'settlementAccountReturnUrl'

function getCurrentPageUrl() {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  if (!page || !page.route) return '/pages/index/index'
  const query = page.options
    ? Object.keys(page.options)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(page.options[key]))
      .join('&')
    : ''
  return '/' + page.route + (query ? '?' + query : '')
}

function fetchSettlementAccountStatus() {
  return request({ url: '/api/v1/user/bank-card' })
}

async function ensureSettlementAccountActive(returnUrl) {
  let account
  try {
    account = await fetchSettlementAccountStatus()
  } catch (err) {
    wx.showToast({ title: (err && err.message) || '结算账户状态查询失败', icon: 'none' })
    return false
  }

  if (account && account.canPublish === true && account.status === 'ACTIVE') {
    return true
  }

  const target = returnUrl || getCurrentPageUrl()
  wx.setStorageSync(RETURN_URL_KEY, target)
  const status = account && account.status
  wx.showToast({
    title: status === 'PENDING' || status === 'REGISTERED'
      ? '结算账户审核中'
      : '请先开通结算账户',
    icon: 'none'
  })
  safeNavigate({
    url: '/pages/settlement-account/settlement-account?returnUrl=' + encodeURIComponent(target)
  })
  return false
}

function getSettlementReturnUrl() {
  return wx.getStorageSync(RETURN_URL_KEY) || ''
}

function clearSettlementReturnUrl() {
  wx.removeStorageSync(RETURN_URL_KEY)
}

module.exports = {
  RETURN_URL_KEY,
  fetchSettlementAccountStatus,
  ensureSettlementAccountActive,
  getSettlementReturnUrl,
  clearSettlementReturnUrl
}
