const { request } = require('../../utils/request')

const REASON_MAP = {
  1: 2,
  2: 6,
  3: 6,
  4: 3,
  5: 4,
  6: 6,
  7: 6,
  8: 6,
  9: 6
}

Page({
  data: {
    activeTab: 0,
    tabs: ['常规举报', '纠纷事件'],
    categories: [
      { id: 1, name: '垃圾广告', icon: '📢' },
      { id: 2, name: '商品纠纷', icon: '🛒' },
      { id: 3, name: '恶意骚扰', icon: '📞' },
      { id: 4, name: '诈骗信息', icon: '💰' },
      { id: 5, name: '淫秽色情', icon: '🔞' },
      { id: 6, name: '人身攻击', icon: '👊' },
      { id: 7, name: '其他', icon: '📌' },
      { id: 8, name: '政治敏感', icon: '⚖️' },
      { id: 9, name: '网络暴力', icon: '💢' }
    ],
    selectedCategory: 0,
    reason: '',
    reasonMax: 150,
    isAnonymous: false,
    canSubmit: false,
    targetType: 5,
    targetId: null,
    submitting: false
  },

  onLoad(options) {
    options = options || {}
    const typeMap = {
      POST: 1,
      COMMENT: 2,
      USER: 3,
      RENTAL_PRODUCT: 4,
      IDLE_PRODUCT: 5
    }
    const targetType = options.targetType ? typeMap[options.targetType] : 5
    this.setData({
      targetType: targetType || 5,
      targetId: options.targetId ? Number(options.targetId) : null
    })
    this.checkCanSubmit()
  },

  switchTab(e) {
    const { index } = e.currentTarget.dataset
    this.setData({ activeTab: index })
  },

  selectCategory(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ selectedCategory: id })
    this.checkCanSubmit()
  },

  onReasonInput(e) {
    const reason = e.detail.value
    this.setData({ reason })
    this.checkCanSubmit()
  },

  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous })
  },

  checkCanSubmit() {
    const { selectedCategory, reason } = this.data
    const canSubmit = selectedCategory !== 0 && reason.trim().length > 0
    this.setData({ canSubmit })
  },

  onSubmit() {
    if (!this.data.canSubmit) return
    // 纠纷事件 tab：需要订单上下文，暂走提示（后端 dispute 模块未对接本入口）
    if (this.data.activeTab === 1) {
      wx.showToast({
        title: '纠纷申诉请前往订单详情发起',
        icon: 'none'
      })
      return
    }
    if (this.data.submitting) return
    if (!this.data.targetId) {
      wx.showToast({
        title: '缺少举报对象',
        icon: 'none'
      })
      return
    }
    const { targetType, targetId, selectedCategory, reason } = this.data
    this.setData({ submitting: true })
    request({
      url: '/api/v1/report',
      method: 'POST',
      data: {
        targetType,
        targetId,
        reason: REASON_MAP[selectedCategory],
        remark: reason
      }
    })
      .then(() => {
        wx.showToast({
          title: '举报已提交',
          icon: 'success'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      })
      .catch(err => {
        wx.showToast({
          title: (err && err.message) || '提交失败，请重试',
          icon: 'none'
        })
      })
      .finally(() => {
        this.setData({ submitting: false })
      })
  }
})
