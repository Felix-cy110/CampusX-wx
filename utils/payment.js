const { request } = require('./request')

const PAYMENT_SUCCESS = 'S'
const PAYMENT_FAILED = 'F'
const BUSINESS_PROCESSED = 2

function getMiniProgramAppId() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const appId = accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.appId
    if (appId) return appId
  } catch (err) {
    console.warn('获取小程序 AppID 失败，将由后端补齐:', err)
  }
  return ''
}

function parsePayParams(payParams) {
  let params = payParams
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params)
    } catch (err) {
      throw createPaymentError('PAYMENT_PARAMS_INVALID', '支付参数解析失败')
    }
  }

  if (!params || typeof params !== 'object') {
    throw createPaymentError('PAYMENT_PARAMS_INVALID', '后端未返回有效支付参数')
  }

  const normalized = {
    timeStamp: params.timeStamp || params.timestamp || '',
    nonceStr: params.nonceStr || params.nonce_str || '',
    package: params.package || params.packageValue || '',
    signType: params.signType || params.sign_type || 'RSA',
    paySign: params.paySign || params.pay_sign || ''
  }
  if (!normalized.timeStamp || !normalized.nonceStr || !normalized.package || !normalized.paySign) {
    throw createPaymentError('PAYMENT_PARAMS_INVALID', '后端返回的微信支付参数不完整')
  }
  return normalized
}

function createPaymentError(code, message, extra) {
  const error = new Error(message)
  error.code = code
  if (extra) Object.assign(error, extra)
  return error
}

function createPaymentOrder(options) {
  const data = Object.assign({}, options.data || {})
  const appId = getMiniProgramAppId()
  if (appId) data.subAppid = appId

  return request({
    url: options.url,
    method: options.method || 'POST',
    data
  }).then(paymentOrder => {
    const paymentNo = paymentOrder && (paymentOrder.paymentNo || paymentOrder.orderNo)
    if (!paymentOrder || !paymentNo || !paymentOrder.payParams) {
      throw createPaymentError('PAYMENT_ORDER_INVALID', '后端未返回完整支付订单')
    }
    return Object.assign({}, paymentOrder, { paymentNo })
  })
}

function requestPayment(payParams) {
  let params
  try {
    params = parsePayParams(payParams)
  } catch (err) {
    return Promise.reject(err)
  }

  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: resolve,
      fail: err => {
        const message = err && err.errMsg ? err.errMsg : ''
        if (message.indexOf('cancel') !== -1) {
          reject(createPaymentError('PAYMENT_CANCELLED', '已取消支付'))
          return
        }
        reject(createPaymentError('PAYMENT_INVOKE_FAILED', '微信支付失败，请稍后重试', { cause: err }))
      }
    })
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForPaymentResult(paymentNo, options) {
  const maxAttempts = options && options.maxAttempts || 15
  const intervalMs = options && options.intervalMs || 1000
  let paymentSucceeded = false

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payment = await request({
      url: `/api/v1/payment/query/${encodeURIComponent(paymentNo)}`,
      method: 'GET'
    })

    if (payment && payment.transStat === PAYMENT_FAILED) {
      throw createPaymentError('PAYMENT_FAILED', '支付未成功，请重新支付')
    }
    if (payment && payment.transStat === PAYMENT_SUCCESS) {
      paymentSucceeded = true
      if (payment.businessProcessed === true || payment.notifyStatus === BUSINESS_PROCESSED) {
        return payment
      }
    }

    if (attempt < maxAttempts - 1) await delay(intervalMs)
  }

  if (paymentSucceeded) {
    throw createPaymentError(
      'PAYMENT_BUSINESS_PROCESSING',
      '支付已经成功，订单状态正在更新，请稍后刷新',
      { paymentSucceeded: true }
    )
  }
  throw createPaymentError('PAYMENT_CONFIRM_TIMEOUT', '暂未确认支付结果，请稍后在订单中查看')
}

function isPaymentProcessingError(error) {
  return !!(error && (
    error.code === 'PAYMENT_BUSINESS_PROCESSING' ||
    error.code === 'PAYMENT_CONFIRM_TIMEOUT'
  ))
}

function isPaymentCancelledError(error) {
  return !!(error && error.code === 'PAYMENT_CANCELLED')
}

module.exports = {
  createPaymentOrder,
  requestPayment,
  waitForPaymentResult,
  isPaymentProcessingError,
  isPaymentCancelledError
}
