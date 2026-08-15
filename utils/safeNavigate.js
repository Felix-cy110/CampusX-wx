const MAX_PAGE_DEPTH = 9
const { guardNavigation } = require('./auth')

function safeNavigate(config) {
  const { showLoading = true, ...navConfig } = config
  if (!guardNavigation(navConfig.url, 'navigateTo')) return false
  if (showLoading) {
    wx.showLoading({ title: '', mask: true })
  }
  const done = () => { if (showLoading) wx.hideLoading() }
  const wrap = (fn) => fn ? (res) => { done(); fn(res) } : done
  const opts = { ...navConfig, success: wrap(navConfig.success), fail: wrap(navConfig.fail) }
  const pages = getCurrentPages()
  if (pages.length >= MAX_PAGE_DEPTH) {
    wx.redirectTo(opts)
  } else {
    wx.navigateTo(opts)
  }
  return true
}

function safeSwitch(config) {
  if (!guardNavigation(config.url, 'navigateTo')) return false
  wx.showLoading({ title: '', mask: true })
  const done = () => wx.hideLoading()
  const wrap = (fn) => fn ? (res) => { done(); fn(res) } : done
  wx.switchTab({ ...config, success: wrap(config.success), fail: wrap(config.fail) })
  return true
}

module.exports = { safeNavigate, safeSwitch }
