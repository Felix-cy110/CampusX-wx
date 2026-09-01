const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')
const {
  createPaymentOrder,
  requestPayment,
  waitForPaymentResult,
  isPaymentProcessingError,
  isPaymentCancelledError
} = require('../../utils/payment')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    currentTab: 'all',
    currentSide: 'buy',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'secondhand', label: '二手' },
      { key: 'rental', label: '租赁' },
      { key: 'errand', label: '跑腿' }
    ],
    orders: [],
    filteredOrders: [],
    loading: false,
    payingOrderKey: ''
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  goBack() {
    wx.navigateBack()
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ currentTab: key, currentSide: 'buy' })
    this.loadOrders()
  },

  switchSide(e) {
    const side = e.currentTarget.dataset.side
    this.setData({ currentSide: side })
    this.loadOrders()
  },

  /* 从后端加载订单 */
  async loadOrders() {
    const { currentTab, currentSide } = this.data
    this.setData({ loading: true })

    try {
      let orders = []

      if (currentTab === 'all') {
        // 全部：并行请求三个 API（各 fetch 方法内部已处理异常，始终返回数组）
        const results = await Promise.all([
          this.fetchIdleOrders(currentSide),
          this.fetchRentalOrders(currentSide),
          this.fetchProxyOrders(currentSide)
        ])
        results.forEach(arr => {
          if (arr && arr.length) {
            orders = orders.concat(arr)
          }
        })
      } else if (currentTab === 'secondhand') {
        orders = await this.fetchIdleOrders(currentSide)
      } else if (currentTab === 'rental') {
        orders = await this.fetchRentalOrders(currentSide)
      } else if (currentTab === 'errand') {
        orders = await this.fetchProxyOrders(currentSide)
      }

      this.setData({ orders, filteredOrders: orders, loading: false })
    } catch (err) {
      console.error('加载订单失败:', err)
      this.setData({ loading: false })
    }
  },

  /* 获取二手订单 */
  async fetchIdleOrders(side) {
    try {
      const endpoint = side === 'buy' ? '/api/v1/idle/order/buyer-list' : '/api/v1/idle/order/seller-list'
      const result = await request({ url: endpoint, method: 'GET' })
      const list = (result && result.list) || []
      return list.map(vo => this.mapIdleOrder(vo, side))
    } catch (err) {
      console.error('加载二手订单失败:', err)
      return []
    }
  },

  /* 获取租赁订单 */
  async fetchRentalOrders(side) {
    try {
      const endpoint = side === 'buy' ? '/api/v1/rental/order/buyer-list' : '/api/v1/rental/order/seller-list'
      const result = await request({ url: endpoint, method: 'GET' })
      const list = (result && result.list) || []
      return list.map(vo => this.mapRentalOrder(vo, side))
    } catch (err) {
      console.error('加载租赁订单失败:', err)
      return []
    }
  },

  /* 获取跑腿（代课）订单 */
  async fetchProxyOrders(side) {
    try {
      const role = side === 'buy' ? 1 : 2
      const result = await request({
        url: '/api/v1/proxy-class-order/my-list',
        method: 'GET',
        data: { role, pageNum: 1, pageSize: 50 }
      })
      const list = (result && result.list) || []
      return list.map(vo => this.mapProxyOrder(vo, side))
    } catch (err) {
      console.error('加载跑腿订单失败:', err)
      return []
    }
  },

  /* 映射二手订单为统一格式 */
  mapIdleOrder(vo, side) {
    const statusDesc = vo.statusDesc || ''
    const statusBgMap = {
      '待付款': '#FF4D4F',
      '待发货': '#FF9500',
      '待收货': '#255AC5',
      '已完成': '#14B554',
      '已取消': '#999999',
      '退款申请中': '#FF4D4F'
    }
    return {
      id: vo.id,
      orderNo: vo.orderNo,
      type: 'secondhand',
      side: side,
      user: {
        name: vo.counterpartyNickname || '',
        avatar: toFullUrl(vo.counterpartyAvatarUrl) || ''
      },
      content: vo.productTitle || '',
      image: toFullUrl(vo.productImage) || '',
      typeLabel: '二手',
      typeLabelColor: '#255AC5',
      priceLabel: '实付款',
      price: Number(vo.actualPaid || vo.price || 0),
      status: statusDesc,
      statusBg: statusBgMap[statusDesc] || '#999999',
      remark: '',
      showConfirmBtn: vo.status === 2 && side === 'buy',
      showCancelBtn: vo.status === 0,
      showPayBtn: vo.status === 0 && side === 'buy',
      showRefundBtn: vo.status === 2 && side === 'buy',
      showRefundAgreeBtn: vo.status === 5 && side === 'sell',
      showRefundRejectBtn: vo.status === 5 && side === 'sell',
      targetId: vo.productId,
      targetType: 'market'
    }
  },

  /* 映射租赁订单为统一格式 */
  mapRentalOrder(vo, side) {
    const statusDesc = vo.statusDesc || ''
    const statusBgMap = {
      '待付款': '#FF4D4F',
      '待交接': '#FF9500',
      '租用中': '#255AC5',
      '待归还': '#FF9500',
      '已完成': '#14B554',
      '已取消': '#999999',
      '毁损申诉': '#FF4D4F'
    }
    const counterpartyName = side === 'buy' ? vo.sellerNickname : vo.buyerNickname
    const counterpartyAvatar = side === 'buy' ? vo.sellerAvatar : vo.buyerAvatar
    let remark = ''
    if (vo.status === 2 && vo.rentEnd) {
      remark = '正在租用中，归还时间' + (vo.rentEnd || '')
    }
    return {
      id: vo.id,
      orderNo: vo.orderNo,
      type: 'rental',
      side: side,
      user: {
        name: counterpartyName || '',
        avatar: toFullUrl(counterpartyAvatar) || ''
      },
      content: vo.productTitle || '',
      image: toFullUrl(vo.productImage) || '',
      typeLabel: '租赁',
      typeLabelColor: '#FF9500',
      priceLabel: '实付款',
      price: Number(vo.actualPaid || 0),
      status: statusDesc,
      statusBg: statusBgMap[statusDesc] || '#999999',
      remark: remark,
      showConfirmBtn: false,
      showCancelBtn: vo.status === 1,
      showPayBtn: vo.status === 1 && side === 'buy',
      showRefundBtn: false,
      showRefundAgreeBtn: false,
      showRefundRejectBtn: false,
      targetId: vo.productId,
      targetType: 'market'
    }
  },

  /* 映射跑腿（代课）订单为统一格式 */
  mapProxyOrder(vo, side) {
    const statusDesc = vo.statusDesc || ''
    const statusBgMap = {
      '待需求方确认': '#FF4D4F',
      '待买方付款': '#FF4D4F',
      '待卖方缴押金': '#FF9500',
      '代课中': '#255AC5',
      '待买方确认': '#FF9500',
      '已完成': '#14B554',
      '已取消': '#999999',
      '违约申诉': '#FF4D4F'
    }
    let remark = ''
    if (vo.classTime) {
      remark = '上课时间：' + (vo.classTime || '')
    }
    return {
      id: vo.orderId,
      orderNo: vo.orderNo,
      type: 'errand',
      side: side,
      user: {
        name: vo.counterpartyNickname || '',
        avatar: toFullUrl(vo.counterpartyAvatarUrl) || ''
      },
      content: vo.courseName || '',
      image: '',
      typeLabel: '跑腿',
      typeLabelColor: '#255AC5',
      priceLabel: '应付款',
      price: Number(vo.fee || 0),
      status: statusDesc,
      statusBg: statusBgMap[statusDesc] || '#999999',
      remark: remark,
      showConfirmBtn: vo.status === 5 && side === 'buy',
      showCancelBtn: vo.status === 1 && side === 'buy',
      showPayBtn: vo.status === 2 && side === 'buy',
      showDepositBtn: vo.status === 3 && side === 'sell',
      showRefundBtn: false,
      showRefundAgreeBtn: false,
      showRefundRejectBtn: false,
      targetId: vo.demandId,
      targetType: 'post'
    }
  },

  onOrderTap(e) {
    const { targetid, targettype } = e.currentTarget.dataset
    if (!targetid || !targettype) return

    const urlMap = {
      market: `/pages/market-detail/market-detail?id=${targetid}`,
      post: `/pages/post-detail/post-detail?id=${targetid}`
    }
    const url = urlMap[targettype]
    if (url) {
      safeNavigate({ url })
    }
  },

  onConfirmReceipt(e) {
    const { id, type, side } = e.currentTarget.dataset
    let confirmText = '请确认已经收到货物，确认收货后订单将关闭'
    if (type === 'errand') {
      confirmText = side === 'buy' ? '请确认代课已完成，确认后订单将关闭' : '请确认已将代课标记为完成'
    } else if (type === 'rental') {
      confirmText = side === 'buy' ? '确认发起归还？' : '确认已收到归还物品？'
    }

    wx.showModal({
      title: '',
      content: confirmText,
      confirmText: '是',
      cancelText: '否',
      confirmColor: '#255AC5',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (type === 'secondhand') {
              await request({ url: `/api/v1/idle/order/${id}/confirm`, method: 'PUT' })
            } else if (type === 'rental') {
              if (side === 'buy') {
                await request({ url: `/api/v1/rental/order/${id}/return`, method: 'PUT' })
              } else {
                await request({ url: `/api/v1/rental/order/${id}/confirm-return`, method: 'PUT' })
              }
            } else if (type === 'errand') {
              if (side === 'buy') {
                await request({ url: `/api/v1/proxy-class-order/${id}/confirm-complete`, method: 'POST' })
              } else {
                await request({ url: `/api/v1/proxy-class-order/${id}/mark-complete`, method: 'POST' })
              }
            }
            wx.showToast({ title: '操作成功', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            console.error('确认收货失败:', err)
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  /* 取消订单 */
  onCancelOrder(e) {
    const { id, type } = e.currentTarget.dataset
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      confirmText: '确定',
      cancelText: '再想想',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (type === 'secondhand') {
              await request({ url: `/api/v1/idle/order/${id}/cancel`, method: 'PUT' })
            } else if (type === 'rental') {
              await request({ url: `/api/v1/rental/order/${id}/cancel`, method: 'PUT' })
            } else if (type === 'errand') {
              await request({ url: `/api/v1/proxy-class-order/${id}/cancel`, method: 'POST' })
            }
            wx.showToast({ title: '已取消', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            console.error('取消订单失败:', err)
            wx.showToast({ title: (err && err.message) || '取消失败', icon: 'none' })
          }
        }
      }
    })
  },

  async runPayment(options) {
    if (this.data.payingOrderKey) return
    this.setData({ payingOrderKey: options.key })

    try {
      wx.showLoading({ title: '创建支付...', mask: true })
      const paymentOrder = await createPaymentOrder({
        url: options.url,
        data: options.data
      })
      wx.hideLoading()

      await requestPayment(paymentOrder.payParams)

      wx.showLoading({ title: '确认支付结果...', mask: true })
      await waitForPaymentResult(paymentOrder.paymentNo)
      wx.hideLoading()

      wx.showToast({ title: options.successTitle, icon: 'success' })
      await this.loadOrders()
    } catch (err) {
      wx.hideLoading()
      console.error('订单支付失败:', err)
      if (isPaymentCancelledError(err)) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else if (isPaymentProcessingError(err)) {
        wx.showModal({
          title: err.paymentSucceeded ? '支付成功' : '支付结果确认中',
          content: err.message,
          showCancel: false,
          confirmText: '知道了'
        })
        await this.loadOrders()
      } else {
        wx.showToast({ title: (err && err.message) || '支付失败', icon: 'none' })
      }
    } finally {
      this.setData({ payingOrderKey: '' })
    }
  },

  /* 去支付 */
  async onPayOrder(e) {
    const { id, type } = e.currentTarget.dataset
    const paymentOptions = {
      secondhand: {
        url: `/api/v1/idle/order/${id}/pay`,
        data: {}
      },
      rental: {
        url: `/api/v1/rental/order/${id}/pay`,
        data: {}
      },
      errand: {
        url: '/api/v1/proxy-class-order/pay',
        data: { orderId: id }
      }
    }[type]

    if (!paymentOptions) {
      wx.showToast({ title: '暂不支持该订单支付', icon: 'none' })
      return
    }
    await this.runPayment({
      key: `${type}:${id}:payment`,
      url: paymentOptions.url,
      data: paymentOptions.data,
      successTitle: '支付成功'
    })
  },

  /* 缴纳押金（代课卖方） */
  async onPayDeposit(e) {
    const { id } = e.currentTarget.dataset
    await this.runPayment({
      key: `errand:${id}:deposit`,
      url: '/api/v1/proxy-class-order/deposit-pay',
      data: { orderId: id },
      successTitle: '押金支付成功'
    })
  },

  /* 申请退款 */
  onApplyRefund(e) {
    const { id, type } = e.currentTarget.dataset
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？退款金额将原路返回',
      confirmText: '确定',
      cancelText: '再想想',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (type === 'secondhand') {
              await request({ url: `/api/v1/idle/order/${id}/refund-apply`, method: 'POST' })
            }
            wx.showToast({ title: '退款申请已提交', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            console.error('申请退款失败:', err)
            wx.showToast({ title: (err && err.message) || '申请失败', icon: 'none' })
          }
        }
      }
    })
  },

  /* 同意退款 */
  onRefundAgree(e) {
    const { id, type } = e.currentTarget.dataset
    wx.showModal({
      title: '同意退款',
      content: '确定要同意买家的退款申请吗？',
      confirmText: '确定',
      cancelText: '再想想',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (type === 'secondhand') {
              await request({ url: `/api/v1/idle/order/${id}/refund-agree`, method: 'PUT' })
            }
            wx.showToast({ title: '已同意退款', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            console.error('同意退款失败:', err)
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  /* 拒绝退款 */
  onRefundReject(e) {
    const { id, type } = e.currentTarget.dataset
    wx.showModal({
      title: '拒绝退款',
      content: '确定要拒绝买家的退款申请吗？拒绝后将由管理员介入处理',
      confirmText: '确定拒绝',
      cancelText: '再想想',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (type === 'secondhand') {
              await request({ url: `/api/v1/idle/order/${id}/refund-reject`, method: 'PUT' })
            }
            wx.showToast({ title: '已拒绝退款', icon: 'success' })
            this.loadOrders()
          } catch (err) {
            console.error('拒绝退款失败:', err)
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
          }
        }
      }
    })
  }
})
