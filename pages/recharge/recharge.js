const mock = require('../../utils/mock.js')
const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    quota: 5,
    rechargeOptions: [],
    selectedOption: null,
    customAmount: ''
  },

  onLoad() {
    const quota = app.globalData.crossSchoolQuota || 5
    this.setData({
      quota,
      rechargeOptions: mock.rechargeOptions
    })
  },

  onSelectOption(e) {
    const option = e.currentTarget.dataset.option
    this.setData({
      selectedOption: option,
      customAmount: ''
    })
  },

  onCustomInput(e) {
    this.setData({
      customAmount: e.detail.value,
      selectedOption: null
    })
  },

  onRecharge() {
    let amount = 0

    if (this.data.selectedOption) {
      amount = this.data.selectedOption.amount
    } else if (this.data.customAmount) {
      amount = parseInt(this.data.customAmount)
      if (isNaN(amount) || amount <= 0) {
        wx.showToast({ title: '请输入有效的充值次数', icon: 'none' })
        return
      }
    }

    if (amount <= 0) {
      wx.showToast({ title: '请选择或输入充值次数', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认充值',
      content: '确认充值 ' + amount + ' 次跨校发帖额度？',
      success: (res) => {
        if (res.confirm) {
          // 更新全局额度
          app.globalData.crossSchoolQuota = this.data.quota + amount
          safeNavigate({
            url: '/pages/recharge-success/recharge-success?amount=' + amount + '&quota=' + (this.data.quota + amount)
          })
        }
      }
    })
  }
})
