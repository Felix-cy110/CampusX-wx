const MAX_PAGE_DEPTH = 9

function safeNavigate(config) {
  const { showLoading = true, ...navConfig } = config
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
}

function safeSwitch(config) {
  wx.showLoading({ title: '', mask: true })
  const done = () => wx.hideLoading()
  const wrap = (fn) => fn ? (res) => { done(); fn(res) } : done
  wx.switchTab({ ...config, success: wrap(config.success), fail: wrap(config.fail) })
}

module.exports = { safeNavigate, safeSwitch }
