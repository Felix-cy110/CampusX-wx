const mock = require('../../utils/mock')

const STATUS_LABEL = ['待付定金', '已付定金·待尾款', '已完成', '已取消', '已退款']
const STATUS_COLOR = ['color-orange', 'color-orange', 'color-green', 'color-secondary', 'color-secondary']

Page({
  data: {
    presale: null,
    myOrder: null,
    quantity: 1,
    totalPrice: '0.00',
    depositPrice: '0.00',
    safeAreaBottom: 0,
    statusBarHeight: 0,
    navBarHeight: 0
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
    const presale = mock.presales.find(p => p.id === id)
    if (!presale) return

    const myOrder = mock.presaleOrders.find(o => o.presaleId === id) || null
    const formattedOrder = myOrder ? {
      ...myOrder,
      statusLabel: STATUS_LABEL[myOrder.status] || '未知',
      statusColor: STATUS_COLOR[myOrder.status] || ''
    } : null

    this.setData({ presale, myOrder: formattedOrder })
    this._updatePrice(1, presale.price)
  },

  _updatePrice(qty, unitPrice) {
    const total = (qty * unitPrice).toFixed(2)
    const deposit = (qty * unitPrice * 0.4).toFixed(2)
    this.setData({ quantity: qty, totalPrice: total, depositPrice: deposit })
  },

  increaseQty() {
    const { quantity, presale } = this.data
    const max = presale.stock > 0 ? presale.stock - presale.orderedCount : 99
    if (quantity < max) this._updatePrice(quantity + 1, presale.price)
  },

  decreaseQty() {
    if (this.data.quantity > 1) this._updatePrice(this.data.quantity - 1, this.data.presale.price)
  },

  onSubmitOrder() {
    const { presale, quantity, totalPrice, depositPrice } = this.data
    const newOrder = {
      id: Date.now(),
      orderNo: 'BP' + Date.now(),
      presaleId: presale.id,
      quantity,
      unitPrice: presale.price,
      totalAmount: totalPrice,
      depositAmount: depositPrice,
      finalAmount: (totalPrice - depositPrice).toFixed(2),
      status: 0,
      statusLabel: STATUS_LABEL[0],
      statusColor: STATUS_COLOR[0],
      finalPayDeadline: '活动结束后7天内'
    }
    mock.presaleOrders.push(newOrder)
    presale.orderedCount += quantity
    this.setData({ myOrder: newOrder })
    wx.showToast({ title: '预购成功', icon: 'success' })
  },

  onPayDeposit() {
    wx.showToast({ title: '定金支付成功', icon: 'success' })
    this.data.myOrder.status = 1
    this.setData({
      myOrder: { ...this.data.myOrder, status: 1, statusLabel: STATUS_LABEL[1], statusColor: STATUS_COLOR[1] }
    })
  },

  onPayFinal() {
    wx.showToast({ title: '尾款支付成功', icon: 'success' })
    this.setData({
      myOrder: { ...this.data.myOrder, status: 2, statusLabel: STATUS_LABEL[2], statusColor: STATUS_COLOR[2] }
    })
  },

  onCancelOrder() {
    wx.showModal({
      title: '确认取消',
      content: '取消后定金不予退还，确认取消吗？',
      success: (res) => {
        if (!res.confirm) return
        this.setData({
          myOrder: { ...this.data.myOrder, status: 3, statusLabel: STATUS_LABEL[3], statusColor: STATUS_COLOR[3] }
        })
        wx.showToast({ title: '已取消', icon: 'none' })
      }
    })
  },

  navigateBack() {
    wx.navigateBack()
  }
})
