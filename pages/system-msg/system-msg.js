const { request } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')
const { markNotificationRead } = require('../../utils/unread')

Page({
  data: {
    messages: [],
    loading: false,
    hasMore: true,
    nextCursor: null,
    statusBarHeight: 0,
    navBarHeight: 0,

    // detail overlay
    showDetail: false,
    detail: null,
    detailAnim: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
    this.loadMessages()
  },

  loadMessages() {
    if (this.data.loading || !this.data.hasMore) return Promise.resolve()
    this.setData({ loading: true })
    const params = { size: 20 }
    if (this.data.nextCursor) params.cursor = this.data.nextCursor
    const isFirstPage = !this.data.nextCursor

    return request({ url: '/api/v1/notification/system', data: params }).then(data => {
      const rawList = data.list || []
      const list = rawList.map(mapSystemMessage)
      this.setData({
        messages: isFirstPage ? list : this.data.messages.concat(list),
        loading: false,
        hasMore: data.hasMore !== undefined ? data.hasMore : list.length >= 20,
        nextCursor: data.nextCursor || null
      })
      if (isFirstPage && rawList.length > 0 && rawList[0].createdAt) {
        this.markSystemRead(rawList[0].createdAt)
      }
    }).catch(err => {
      console.error('加载系统消息失败:', err)
      this.setData({ loading: false })
    })
  },

  onScrollToLower() {
    this.loadMessages()
  },

  showDetail(e) {
    const id = e.currentTarget.dataset.id
    const msg = this.data.messages.find(m => m.id === id)
    if (!msg) return

    // 标记已读
    const messages = this.data.messages.map(m =>
      m.id === id ? { ...m, unread: false } : m
    )
    this.setData({
      messages,
      detail: msg,
      showDetail: true
    })

    // 触发 slide-in 动画
    setTimeout(() => {
      this.setData({ detailAnim: true })
    }, 30)
  },

  hideDetail() {
    this.setData({ detailAnim: false })
    setTimeout(() => {
      this.setData({ showDetail: false, detail: null })
    }, 280)
  },

  navigateBack() {
    wx.navigateBack()
  },

  goToOrder() {
    this.hideDetail()
    safeNavigate({ url: '/pages/order/order?tab=secondhand&side=sell' })
  },

  /** 标记系统消息为已读，并立即刷新 tabBar badge */
  markSystemRead(readThrough) {
    return markNotificationRead('system', readThrough).then(() => {
      this.setData({
        messages: this.data.messages.map(message => ({ ...message, unread: false }))
      })
    }).catch(function (err) {
      console.error('标记系统消息已读失败:', err)
    })
  }
})

function mapSystemMessage(item) {
  const buyer = item.buyerNickname || '有同学'
  const product = item.productTitle || '闲置商品'
  const amount = Number(item.amount || 0).toFixed(2)
  return {
    id: item.cursorId || item.orderId,
    orderId: item.orderId,
    title: '商品已付款',
    brief: `${buyer} 已购买「${product}」`,
    msg: `${buyer} 已支付 ¥${amount} 购买「${product}」。请前往“我卖出的”查看订单并尽快完成交付。\n订单号：${item.orderNo || ''}`,
    time: formatRelativeTime(item.createdAt),
    createdAt: item.createdAt,
    unread: true
  }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  let date
  if (Array.isArray(dateStr)) {
    date = new Date(dateStr[0], dateStr[1] - 1, dateStr[2],
      dateStr[3] || 0, dateStr[4] || 0, dateStr[5] || 0)
  } else {
    date = new Date(String(dateStr).replace('T', ' ').replace(/-/g, '/'))
  }
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return minutes + '分钟前'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + '小时前'
  const days = Math.floor(hours / 24)
  if (days < 30) return days + '天前'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
