const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    order: null,
    loading: true,
    id: '',
    type: '',
    side: ''
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height,
      id: options.id || '',
      type: options.type || 'secondhand',
      side: options.side || 'buy'
    })
    this.loadOrderDetail()
  },

  async loadOrderDetail() {
    const { id, type, side } = this.data
    if (!id) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })
    try {
      let vo
      if (type === 'secondhand') {
        vo = await request({ url: `/api/v1/idle/order/${id}`, method: 'GET' })
        this.setData({ order: this.mapIdleOrder(vo, side), loading: false })
      } else if (type === 'rental') {
        vo = await request({ url: `/api/v1/rental/order/${id}`, method: 'GET' })
        this.setData({ order: this.mapRentalOrder(vo, side), loading: false })
      } else if (type === 'errand') {
        vo = await request({ url: `/api/v1/proxy-class-order/detail`, method: 'GET', data: { orderId: Number(id) } })
        this.setData({ order: this.mapProxyOrder(vo, side), loading: false })
      }
    } catch (err) {
      console.error('加载订单详情失败:', err)
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  /* 映射二手订单 */
  mapIdleOrder(vo, side) {
    const statusMap = { 0: '待付款', 1: '待发货', 2: '待收货', 3: '已完成', 4: '已取消', 5: '退款申请中' }
    const statusColorMap = { 0: '#FF4D4F', 1: '#FF9500', 2: '#255AC5', 3: '#14B554', 4: '#999999', 5: '#FF4D4F' }
    const status = vo.status
    const isBuyer = side === 'buy'

    return {
      orderNo: vo.orderNo || '',
      status,
      statusDesc: vo.statusDesc || statusMap[status] || '',
      statusColor: statusColorMap[status] || '#999999',
      counterparty: {
        name: vo.counterpartyNickname || '',
        avatar: toFullUrl(vo.counterpartyAvatarUrl) || ''
      },
      product: {
        title: vo.productTitle || '',
        image: toFullUrl(vo.productImage) || ''
      },
      price: Number(vo.price || 0),
      serviceFee: Number(vo.serviceFee || 0),
      actualPaid: Number(vo.actualPaid || 0),
      createdAt: this.formatTime(vo.createdAt),
      payTime: this.formatTime(vo.payTime),
      shipTime: this.formatTime(vo.shipTime),
      confirmTime: this.formatTime(vo.confirmTime),
      cancelReason: vo.cancelReason || '',
      actions: this.getIdleActions(status, isBuyer)
    }
  },

  /* 二手订单操作按钮 */
  getIdleActions(status, isBuyer) {
    const actions = []
    if (status === 0 && isBuyer) {
      actions.push({ key: 'pay', label: '去付款', type: 'primary' })
      actions.push({ key: 'cancel', label: '取消订单', type: 'default' })
    }
    if (status === 1 && !isBuyer) {
      actions.push({ key: 'ship', label: '确认发货', type: 'primary' })
    }
    if (status === 1 && isBuyer) {
      actions.push({ key: 'cancel', label: '取消订单', type: 'default' })
    }
    if (status === 2 && isBuyer) {
      actions.push({ key: 'confirm', label: '确认收货', type: 'primary' })
      actions.push({ key: 'refund', label: '申请退款', type: 'default' })
    }
    if (status === 5 && !isBuyer) {
      actions.push({ key: 'agreeRefund', label: '同意退款', type: 'primary' })
      actions.push({ key: 'rejectRefund', label: '拒绝退款', type: 'default' })
    }
    return actions
  },

  /* 映射租赁订单 */
  mapRentalOrder(vo, side) {
    const statusMap = { 0: '待付款', 1: '待交接', 2: '租用中', 3: '待归还', 4: '已完成', 5: '已取消', 6: '毁损申诉' }
    const statusColorMap = { 0: '#FF4D4F', 1: '#FF9500', 2: '#255AC5', 3: '#FF9500', 4: '#14B554', 5: '#999999', 6: '#FF4D4F' }
    const status = vo.status
    const isBuyer = side === 'buy'
    const counterpartyName = isBuyer ? vo.sellerNickname : vo.buyerNickname
    const counterpartyAvatar = isBuyer ? vo.sellerAvatar : vo.buyerAvatar

    return {
      orderNo: vo.orderNo || '',
      status,
      statusDesc: vo.statusDesc || statusMap[status] || '',
      statusColor: statusColorMap[status] || '#999999',
      counterparty: {
        name: counterpartyName || '',
        avatar: toFullUrl(counterpartyAvatar) || ''
      },
      product: {
        title: vo.productTitle || '',
        image: toFullUrl(vo.productImage) || ''
      },
      price: Number(vo.rentPrice || 0),
      serviceFee: Number(vo.serviceFee || 0),
      actualPaid: Number(vo.actualPaid || 0),
      deposit: Number(vo.deposit || 0),
      rentStart: vo.rentStart || '',
      rentEnd: vo.rentEnd || '',
      createdAt: this.formatTime(vo.createdAt),
      payTime: this.formatTime(vo.payTime),
      handOverTime: this.formatTime(vo.handOverTime),
      returnTime: this.formatTime(vo.returnTime),
      confirmReturnTime: this.formatTime(vo.confirmReturnTime),
      cancelReason: vo.cancelReason || '',
      actions: this.getRentalActions(status, isBuyer)
    }
  },

  /* 租赁订单操作按钮 */
  getRentalActions(status, isBuyer) {
    const actions = []
    if (status === 0 && isBuyer) {
      actions.push({ key: 'pay', label: '去付款', type: 'primary' })
      actions.push({ key: 'cancel', label: '取消订单', type: 'default' })
    }
    if (status === 1 && !isBuyer) {
      actions.push({ key: 'confirmHandover', label: '确认交接', type: 'primary' })
    }
    if (status === 2 && isBuyer) {
      actions.push({ key: 'initiateReturn', label: '发起归还', type: 'primary' })
    }
    if (status === 3 && !isBuyer) {
      actions.push({ key: 'confirmReturn', label: '确认归还', type: 'primary' })
    }
    return actions
  },

  /* 映射跑腿订单 */
  mapProxyOrder(vo, side) {
    const statusMap = { 0: '待需求方确认', 1: '待买方付款', 2: '待卖方缴押金', 3: '代课中', 4: '待买方确认', 5: '已完成', 6: '已取消', 7: '违约申诉' }
    const statusColorMap = { 0: '#FF4D4F', 1: '#FF4D4F', 2: '#FF9500', 3: '#255AC5', 4: '#FF9500', 5: '#14B554', 6: '#999999', 7: '#FF4D4F' }
    const status = vo.status
    const isBuyer = side === 'buy'

    return {
      orderNo: vo.orderNo || '',
      status,
      statusDesc: vo.statusDesc || statusMap[status] || '',
      statusColor: statusColorMap[status] || '#999999',
      counterparty: {
        name: vo.counterpartyNickname || '',
        avatar: toFullUrl(vo.counterpartyAvatarUrl) || ''
      },
      product: {
        title: vo.courseName || '',
        image: ''
      },
      price: Number(vo.fee || 0),
      serviceFee: 0,
      actualPaid: Number(vo.fee || 0),
      createdAt: this.formatTime(vo.createdAt),
      classTime: vo.classTime || '',
      cancelReason: vo.cancelReason || '',
      actions: this.getProxyActions(status, isBuyer)
    }
  },

  /* 跑腿订单操作按钮 */
  getProxyActions(status, isBuyer) {
    const actions = []
    if (status === 1 && isBuyer) {
      actions.push({ key: 'pay', label: '去付款', type: 'primary' })
    }
    if (status === 2 && !isBuyer) {
      actions.push({ key: 'depositPay', label: '缴纳押金', type: 'primary' })
    }
    if (status === 3 && isBuyer) {
      actions.push({ key: 'confirmComplete', label: '确认完成', type: 'primary' })
    }
    if (status === 3 && !isBuyer) {
      actions.push({ key: 'markComplete', label: '标记完成', type: 'primary' })
    }
    return actions
  },

  /* 格式化时间 */
  formatTime(timeStr) {
    if (!timeStr) return ''
    return timeStr.replace('T', ' ').slice(0, 16)
  },

  goBack() {
    wx.navigateBack()
  },

  /* 联系对方 */
  contactUser() {
    const { order } = this.data
    if (!order || !order.counterparty) return
    safeNavigate({
      url: `/pages/chat/chat?name=${encodeURIComponent(order.counterparty.name)}&avatar=${encodeURIComponent(order.counterparty.avatar)}`
    })
  },

  /* 操作按钮点击 */
  onAction(e) {
    const { action } = e.currentTarget.dataset
    const { id, type } = this.data
    const actionHandlers = {
      pay: () => this.handlePay(),
      cancel: () => this.handleCancel(),
      ship: () => this.handleShip(),
      confirm: () => this.handleConfirm(),
      refund: () => this.handleRefundApply(),
      agreeRefund: () => this.handleRefundAgree(),
      rejectRefund: () => this.handleRefundReject(),
      confirmHandover: () => this.handleConfirmHandover(),
      initiateReturn: () => this.handleInitiateReturn(),
      confirmReturn: () => this.handleConfirmReturn(),
      depositPay: () => this.handleDepositPay(),
      confirmComplete: () => this.handleConfirmComplete(),
      markComplete: () => this.handleMarkComplete()
    }
    const handler = actionHandlers[action]
    if (handler) handler()
  },

  handlePay() {
    wx.showToast({ title: '支付功能开发中', icon: 'none' })
  },

  async handleCancel() {
    const { id, type } = this.data
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这笔订单吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const url = type === 'rental'
            ? `/api/v1/rental/order/${id}/cancel`
            : `/api/v1/idle/order/${id}/cancel`
          await request({ url, method: 'PUT' })
          wx.showToast({ title: '已取消', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '取消失败', icon: 'none' })
        }
      }
    })
  },

  async handleShip() {
    wx.showModal({
      title: '确认发货',
      content: '确定已发货/已交接吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/idle/order/${this.data.id}/ship`, method: 'PUT' })
          wx.showToast({ title: '已确认发货', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleConfirm() {
    wx.showModal({
      title: '确认收货',
      content: '请确认已收到货物，确认后订单将完成',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/idle/order/${this.data.id}/confirm`, method: 'PUT' })
          wx.showToast({ title: '已确认收货', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleRefundApply() {
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/idle/order/${this.data.id}/refund-apply`, method: 'POST' })
          wx.showToast({ title: '退款申请已提交', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleRefundAgree() {
    wx.showModal({
      title: '同意退款',
      content: '确定同意退款吗？款项将退还给买家',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/idle/order/${this.data.id}/refund-agree`, method: 'PUT' })
          wx.showToast({ title: '已同意退款', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleRefundReject() {
    wx.showModal({
      title: '拒绝退款',
      content: '确定拒绝退款申请吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/idle/order/${this.data.id}/refund-reject`, method: 'PUT' })
          wx.showToast({ title: '已拒绝退款', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleConfirmHandover() {
    wx.showModal({
      title: '确认交接',
      content: '确定已将物品交接给租客吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/rental/order/${this.data.id}/confirm-handover`, method: 'PUT' })
          wx.showToast({ title: '已确认交接', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleInitiateReturn() {
    wx.showModal({
      title: '发起归还',
      content: '确定发起归还吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/rental/order/${this.data.id}/return`, method: 'PUT' })
          wx.showToast({ title: '已发起归还', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleConfirmReturn() {
    wx.showModal({
      title: '确认归还',
      content: '确定已收到归还物品吗？订单将完成',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/rental/order/${this.data.id}/confirm-return`, method: 'PUT' })
          wx.showToast({ title: '已确认归还', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  handleDepositPay() {
    wx.showToast({ title: '押金支付功能开发中', icon: 'none' })
  },

  async handleConfirmComplete() {
    wx.showModal({
      title: '确认完成',
      content: '确定代课已完成吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/proxy-class-order/${this.data.id}/confirm-complete`, method: 'POST' })
          wx.showToast({ title: '已确认完成', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  async handleMarkComplete() {
    wx.showModal({
      title: '标记完成',
      content: '确定将代课标记为完成吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await request({ url: `/api/v1/proxy-class-order/${this.data.id}/mark-complete`, method: 'POST' })
          wx.showToast({ title: '已标记完成', icon: 'success' })
          this.loadOrderDetail()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  /* 点击商品跳转商品详情 */
  goToProduct() {
    const { order, type } = this.data
    if (type === 'errand') return
    safeNavigate({ url: `/pages/market-detail/market-detail?id=${this.data.id}` })
  }
})
