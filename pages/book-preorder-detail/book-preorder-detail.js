const { request, toFullUrl } = require('../../utils/request')
const {
  createPaymentOrder,
  requestPayment,
  waitForPaymentResult,
  isPaymentProcessingError,
  isPaymentCancelledError
} = require('../../utils/payment')

const STATUS_LABEL = {
  0: '待付定金',
  1: '已付定金待尾款',
  2: '已付尾款完成',
  3: '已取消定金不退',
  4: '退款取消退总价15%'
}

const STATUS_COLOR = ['color-orange', 'color-orange', 'color-green', 'color-secondary', 'color-secondary']

function formatDateTime(value) {
  if (!value) return ''
  let date
  if (Array.isArray(value)) {
    const [y, m, d, h, min, s] = value
    date = new Date(y, m - 1, d, h || 0, min || 0, s || 0)
  } else {
    date = new Date(value)
  }
  if (isNaN(date.getTime())) return value
  const pad = n => (n < 10 ? '0' + n : n)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatPresale(p) {
  return {
    ...p,
    price: Number(p.price),
    depositAmount: Number(p.depositAmount),
    finalAmount: Number(p.finalAmount),
    coverImage: toFullUrl(p.coverImage),
    startTime: formatDateTime(p.startTime),
    endTime: formatDateTime(p.endTime)
  }
}

function formatOrder(o) {
  return {
    ...o,
    unitPrice: Number(o.unitPrice),
    totalAmount: Number(o.totalAmount),
    depositAmount: Number(o.depositAmount),
    finalAmount: Number(o.finalAmount),
    refundAmount: o.refundAmount != null ? Number(o.refundAmount) : o.refundAmount,
    finalPayDeadline: formatDateTime(o.finalPayDeadline),
    depositPayTime: formatDateTime(o.depositPayTime),
    finalPayTime: formatDateTime(o.finalPayTime),
    createdAt: formatDateTime(o.createdAt),
    updatedAt: formatDateTime(o.updatedAt),
    statusLabel: STATUS_LABEL[o.status] || '未知',
    statusColor: STATUS_COLOR[o.status] || 'color-secondary'
  }
}

Page({
  data: {
    presale: null,
    myOrder: null,
    quantity: 1,
    totalPrice: '0.00',
    depositPrice: '0.00',
    safeAreaBottom: 0,
    statusBarHeight: 0,
    navBarHeight: 0,
    submitting: false,
    paying: false
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height,
      safeAreaBottom: systemInfo.safeArea ? systemInfo.screenHeight - systemInfo.safeArea.bottom : 0
    })

    const id = parseInt(options.id)
    this._loadPresale(id)
    this._loadMyOrder(id)
  },

  _loadPresale(id) {
    return request({ url: `/api/v1/presale/${id}` })
      .then(data => {
        const presale = formatPresale(data)
        this.setData({ presale })
        this._updatePrice(this.data.quantity, presale.price)
      })
      .catch(err => {
        console.error('获取预购详情失败', err)
        wx.showToast({ title: err.message || '获取详情失败', icon: 'none' })
      })
  },

  _loadMyOrder(id) {
    return request({ url: '/api/v1/presale/orders/my' })
      .then(res => {
        const list = (res && res.list) || []
        const rawOrder = list.find(o => {
          const status = Number(o.status)
          return Number(o.presaleId) === id && status !== 3 && status !== 4
        })
        this.setData({ myOrder: rawOrder ? formatOrder(rawOrder) : null })
      })
      .catch(err => {
        console.error('获取我的预购订单失败', err)
      })
  },

  _updatePrice(qty, unitPrice) {
    const total = (qty * unitPrice).toFixed(2)
    const deposit = (qty * unitPrice * 0.4).toFixed(2)
    this.setData({ quantity: qty, totalPrice: total, depositPrice: deposit })
  },

  increaseQty() {
    const { quantity, presale } = this.data
    if (!presale) return
    const max = presale.stock > 0 ? presale.stock - presale.orderedCount : 99
    if (quantity < max) this._updatePrice(quantity + 1, presale.price)
  },

  decreaseQty() {
    if (!this.data.presale) return
    if (this.data.quantity > 1) this._updatePrice(this.data.quantity - 1, this.data.presale.price)
  },

  onSubmitOrder() {
    if (this.data.submitting) return
    const { presale, quantity } = this.data
    if (!presale) return
    this.setData({ submitting: true })
    request({
      url: '/api/v1/presale/orders',
      method: 'POST',
      data: { presaleId: presale.id, quantity }
    })
      .then(data => {
        const myOrder = formatOrder(data)
        this.setData({ myOrder, quantity: 1, submitting: false })
        this._updatePrice(1, presale.price)
        wx.showToast({ title: '预购成功', icon: 'success' })
      })
      .catch(err => {
        console.error('预购下单失败', err)
        this.setData({ submitting: false })
        wx.showToast({ title: err.message || '预购失败', icon: 'none' })
      })
  },

  async runPresalePayment(kind) {
    const { myOrder, presale, paying } = this.data
    if (!myOrder || !presale || paying) return
    const isDeposit = kind === 'deposit'
    this.setData({ paying: true })

    try {
      wx.showLoading({ title: '创建支付...', mask: true })
      const paymentOrder = await createPaymentOrder({
        url: `/api/v1/presale/orders/${myOrder.id}/${isDeposit ? 'pay-deposit' : 'pay-final'}`,
        data: {}
      })
      wx.hideLoading()

      await requestPayment(paymentOrder.payParams)

      wx.showLoading({ title: '确认支付结果...', mask: true })
      await waitForPaymentResult(paymentOrder.paymentNo)
      wx.hideLoading()

      await Promise.all([
        this._loadPresale(presale.id),
        this._loadMyOrder(presale.id)
      ])
      wx.showToast({ title: isDeposit ? '定金支付成功' : '尾款支付成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('预购支付失败:', err)
      if (isPaymentCancelledError(err)) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else if (isPaymentProcessingError(err)) {
        wx.showModal({
          title: err.paymentSucceeded ? '支付成功' : '支付结果确认中',
          content: err.message,
          showCancel: false,
          confirmText: '知道了'
        })
        await this._loadMyOrder(presale.id)
      } else {
        wx.showToast({ title: (err && err.message) || '支付失败', icon: 'none' })
      }
    } finally {
      this.setData({ paying: false })
    }
  },

  onPayDeposit() {
    return this.runPresalePayment('deposit')
  },

  onPayFinal() {
    return this.runPresalePayment('final')
  },

  onCancelOrder() {
    const { myOrder } = this.data
    if (!myOrder) return
    wx.showModal({
      title: '确认取消',
      content: '取消后定金不予退还，确认取消吗？',
      success: (res) => {
        if (!res.confirm) return
        request({
          url: `/api/v1/presale/orders/${myOrder.id}/cancel`,
          method: 'POST'
        })
          .then(() => {
            this.setData({ myOrder: null, quantity: 1 })
            this._loadPresale(myOrder.presaleId)
            wx.showToast({ title: '已取消，可重新预购', icon: 'none' })
          })
          .catch(err => {
            console.error('取消预购订单失败', err)
            wx.showToast({ title: err.message || '取消失败', icon: 'none' })
          })
      }
    })
  },

  navigateBack() {
    wx.navigateBack()
  }
})
