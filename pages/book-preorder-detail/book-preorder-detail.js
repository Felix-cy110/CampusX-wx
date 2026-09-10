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
    statusBarHeight: 0,
    navBarHeight: 0,
    loading: false,
    loadError: '',
    orderLoading: false,
    orderError: '',
    orderView: false,
    submitting: false,
    paying: false
  },

  onLoad(options = {}) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })

    if (options.myOrders === '1') {
      wx.redirectTo({ url: '/pages/book-preorder/book-preorder?tab=orders' })
      return
    }
    const id = String(options.id || '')
    const orderId = options.orderId == null ? '' : String(options.orderId)
    if (!/^[1-9]\d*$/.test(id) || (options.orderId != null && !/^[1-9]\d*$/.test(orderId))) {
      this.setData({ loadError: '预购链接无效，请返回列表重新进入' })
      return
    }
    this._presaleId = id
    this._orderId = orderId
    this.setData({ orderView: !!orderId })
    return this.retryLoad()
  },

  retryLoad() {
    if (!this._presaleId || this.data.loading || this.data.orderLoading) return
    return Promise.all([
      this._loadPresale(this._presaleId),
      this._loadMyOrder(this._presaleId)
    ])
  },

  retryOrder() {
    if (!this._presaleId || this.data.orderLoading) return
    return this._loadMyOrder(this._presaleId)
  },

  _loadPresale(id) {
    this.setData({ loading: true, loadError: '', presale: null })
    return request({ url: `/api/v1/presale/${id}` })
      .then(data => {
        if (!data || String(data.id) !== String(id) || data.price == null || !Number.isFinite(Number(data.price))) {
          throw new Error('预购商品信息不完整，请重试')
        }
        const presale = formatPresale(data)
        this.setData({ presale, loading: false })
        this._updatePrice(this.data.quantity, presale.price)
      })
      .catch(err => {
        console.error('获取预购详情失败', err)
        this.setData({ loading: false, presale: null, loadError: (err && err.message) || '获取预购详情失败，请重试' })
      })
  },

  async _loadMyOrder(id) {
    this.setData({ orderLoading: true, orderError: '' })
    try {
      let cursor
      const cursors = new Set()
      do {
        const res = await request({
          url: '/api/v1/presale/orders/my',
          data: { pageSize: 100, ...(cursor != null ? { cursor } : {}) }
        })
        if (!res || !Array.isArray(res.list)) throw new Error('预购订单信息不完整，请重试')
        const list = res.list
        const rawOrder = list.find(o => {
          if (!o || String(o.presaleId) !== String(id)) return false
          if (this._orderId) return String(o.id) === this._orderId
          const status = Number(o.status)
          return status !== 3 && status !== 4
        })
        if (rawOrder) {
          this.setData({ myOrder: formatOrder(rawOrder) })
          return
        }
        cursor = res.nextCursor
        if (cursor != null) {
          if (cursors.has(String(cursor))) throw new Error('预购订单加载异常，请重试')
          cursors.add(String(cursor))
        }
      } while (cursor != null)
      if (this._orderId) throw new Error('预购订单不存在或无法查看')
      this.setData({ myOrder: null })
    } catch (err) {
      console.error('获取我的预购订单失败', err)
      this.setData({ orderError: (err && err.message) || '获取预购订单失败，请重试' })
    } finally {
      this.setData({ orderLoading: false })
    }
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
    if (this.data.submitting || this.data.loading || this.data.loadError || this.data.orderLoading || this.data.orderError || this.data.orderView || this.data.myOrder) return
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
    if (!myOrder || !presale || paying || this.data.loading || this.data.orderLoading || this.data.orderError) return
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
    if (!myOrder || this.data.loading || this.data.orderLoading || this.data.orderError) return
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
            this._loadMyOrder(myOrder.presaleId)
            wx.showToast({ title: '已取消', icon: 'none' })
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
