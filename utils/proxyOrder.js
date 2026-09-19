const { request } = require('./request')
const { requireAuth } = require('./auth')
const { safeNavigate } = require('./safeNavigate')

// 首页与详情页共用接单流程；调用方在确认和请求期间锁定按钮。
async function confirmAndApplyProxyOrder(demand) {
  if (!demand || !demand.id || !requireAuth()) return

  const currentUid = (getApp().globalData.userInfo || {}).uid
  const publisherId = demand.user && demand.user.uid
  if (publisherId && String(publisherId) === String(currentUid)) {
    wx.showToast({ title: '不能接自己发布的跑腿', icon: 'none' })
    return
  }

  let orderId
  try {
    const confirmed = await new Promise((resolve, reject) => {
      wx.showModal({
        title: '确认接单',
        content: `确定申请接下「${demand.title || ''}」这个跑腿任务吗？报酬 ￥${demand.reward || 0}，提交后等待发布者确认。`,
        success: res => resolve(res.confirm),
        fail: () => reject(new Error('无法打开接单确认，请重试'))
      })
    })
    if (!confirmed) return

    wx.showLoading({ title: '提交申请中...', mask: true })
    try {
      orderId = await request({
        url: '/api/v1/proxy-class-order/apply',
        method: 'POST',
        data: { demandId: demand.id }
      })
    } finally {
      wx.hideLoading()
    }
  } catch (err) {
    wx.showToast({ title: (err && err.message) || '接单失败，请重试', icon: 'none', duration: 2000 })
    return
  }

  wx.showToast({ title: '申请已提交，待发布者确认', icon: 'none', duration: 2000 })
  safeNavigate({ url: '/pages/order/order?tab=errand&side=sell', showLoading: false })
  return orderId
}

module.exports = { confirmAndApplyProxyOrder }
