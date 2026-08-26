const { request } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')
const {
  getSettlementReturnUrl,
  clearSettlementReturnUrl
} = require('../../utils/settlementAccount')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    isBound: false,
    accountStatus: 'NONE',
    statusTitle: '尚未开通结算账户',
    statusReason: '出售商品或发布跑腿前，需要先完成实名开户。',
    statusClass: '',
    canPublish: false,
    showForm: false,
    returnUrl: '',
    checking: true,
    submitting: false,
    agreed: false,
    canSubmit: false,
    validityOptions: ['非长期有效', '长期有效'],
    validityIndex: 0,
    settleOptions: ['D1（次自然日）', 'T1（次工作日）'],
    settleIndex: 0,
    bankRegion: [],
    bankRegionText: '',
    form: {
      realName: '',
      certificateNo: '',
      certBeginDate: '',
      certEndDate: '',
      certValidityType: '0',
      mobileNo: '',
      bankCardNo: '',
      bankName: '',
      provId: '',
      areaId: '',
      intoAcctDateType: 'D1'
    }
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height,
      returnUrl: options && options.returnUrl
        ? decodeURIComponent(options.returnUrl)
        : getSettlementReturnUrl()
    })
    this.loadStatus()
  },

  onBack() { wx.navigateBack() },

  loadStatus(showLoading = false) {
    if (showLoading) wx.showLoading({ title: '查询审核状态...', mask: true })
    request({ url: '/api/v1/user/bank-card' }).then(card => {
      const status = (card && card.status) || 'NONE'
      const active = status === 'ACTIVE' && card && card.canPublish === true
      const statusMeta = {
        NONE: { title: '尚未开通结算账户', className: '' },
        REGISTERED: { title: '汇付用户已开户', className: 'pending' },
        PENDING: { title: '结算账户审核中', className: 'pending' },
        ACTIVE: { title: '汇付结算账户已开通', className: 'success' },
        FAILED: { title: '结算账户开通失败', className: 'failed' }
      }[status] || { title: '结算账户状态待确认', className: 'pending' }
      this.setData({
        isBound: status !== 'NONE',
        accountStatus: status,
        statusTitle: statusMeta.title,
        statusReason: (card && card.statusReason) || '请稍后重试',
        statusClass: statusMeta.className,
        canPublish: active,
        // 已生效账户禁止在普通绑定页直接换卡，避免在途订单突然失去收款账户。
        showForm: status === 'NONE' || status === 'FAILED',
        checking: false
      })
    }).catch(err => {
      wx.showToast({ title: (err && err.message) || '状态查询失败', icon: 'none' })
      this.setData({ checking: false })
    }).finally(() => {
      if (showLoading) wx.hideLoading()
    })
  },

  refreshStatus() {
    this.loadStatus(true)
  },

  continuePublishing() {
    const returnUrl = this.data.returnUrl || getSettlementReturnUrl()
    if (!returnUrl) {
      wx.navigateBack()
      return
    }
    clearSettlementReturnUrl()
    const pages = getCurrentPages()
    const previous = pages.length > 1 ? pages[pages.length - 2] : null
    const expectedRoute = returnUrl.split('?')[0].replace(/^\//, '')
    if (previous && previous.route === expectedRoute) {
      wx.navigateBack()
      return
    }
    safeNavigate({ url: returnUrl })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['form.' + field]: String(e.detail.value || '').trim() })
    this.checkCanSubmit()
  },

  onValidityChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      validityIndex: index,
      'form.certValidityType': index === 1 ? '1' : '0',
      ...(index === 1 ? { 'form.certEndDate': '' } : {})
    })
    this.checkCanSubmit()
  },

  onBeginDateChange(e) {
    this.setData({ 'form.certBeginDate': e.detail.value })
    this.checkCanSubmit()
  },

  onEndDateChange(e) {
    this.setData({ 'form.certEndDate': e.detail.value })
    this.checkCanSubmit()
  },

  onRegionChange(e) {
    const value = e.detail.value || []
    const code = e.detail.code || []
    this.setData({
      bankRegion: value,
      bankRegionText: value.slice(0, 2).join(' / '),
      'form.provId': code[0] || '',
      'form.areaId': code[1] || ''
    })
    this.checkCanSubmit()
  },

  onSettleChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      settleIndex: index,
      'form.intoAcctDateType': index === 1 ? 'T1' : 'D1'
    })
    this.checkCanSubmit()
  },

  onAgreementChange(e) {
    this.setData({ agreed: (e.detail.value || []).indexOf('agreed') >= 0 })
    this.checkCanSubmit()
  },

  checkCanSubmit() {
    const form = this.data.form
    const endDateReady = form.certValidityType === '1' || !!form.certEndDate
    const ready = this.data.agreed && endDateReady && [
      form.realName,
      form.certificateNo,
      form.certBeginDate,
      form.mobileNo,
      form.bankCardNo,
      form.bankName,
      form.provId,
      form.areaId,
      form.intoAcctDateType
    ].every(Boolean)
    this.setData({ canSubmit: ready })
  },

  submit() {
    if (!this.data.canSubmit || this.data.submitting) return
    wx.showModal({
      title: '确认开通结算账户',
      content: '实名及银行卡资料将发送给汇付，用于个人用户开户、分账及自动结算。请确认资料属于本人且准确无误。',
      confirmText: '确认提交',
      success: res => {
        if (res.confirm) this.doSubmit()
      }
    })
  },

  doSubmit() {
    const form = this.data.form
    const payload = {
      ...form,
      certBeginDate: form.certBeginDate.replace(/-/g, ''),
      certEndDate: form.certEndDate ? form.certEndDate.replace(/-/g, '') : ''
    }
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    request({
      url: '/api/v1/user/bank-card/bind',
      method: 'POST',
      data: payload
    }).then(card => {
      wx.hideLoading()
      const active = card && card.status === 'ACTIVE' && card.canPublish === true
      this.setData({ submitting: false })
      wx.showToast({
        title: active ? '结算账户已开通' : '资料已提交，等待审核',
        icon: active ? 'success' : 'none'
      })
      this.loadStatus()
    }).catch(err => {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: (err && err.message) || '开通失败', icon: 'none' })
    })
  }
})
