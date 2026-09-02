const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition
let pendingRequests = []
let paymentInvocations = []
let toasts = []
let modals = []

global.getApp = function () { return { globalData: { userInfo: { uid: '7' } } } }
global.Page = function (definition) { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() {
    return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }
  },
  request(options) { pendingRequests.push(options) },
  requestPayment(options) { paymentInvocations.push(options) },
  showLoading() {},
  hideLoading() {},
  showToast(options) { toasts.push(options) },
  showModal(options) { modals.push(options) }
}

require('../pages/market-detail/market-detail')

function createPage() {
  return {
    data: Object.assign({}, pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) },
    purchaseItem: pageDefinition.purchaseItem
  }
}

function reset() {
  pendingRequests = []
  paymentInvocations = []
  toasts = []
  modals = []
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

const payParams = {
  timeStamp: '1720000000',
  nonceStr: 'nonce',
  package: 'prepay_id=test',
  signType: 'RSA',
  paySign: 'signature'
}

test('点击立即购买并确认后会创建订单、拉起微信支付并查单确认', async function () {
  reset()
  const page = createPage()
  page.data.item = { id: 12, title: '测试商品' }

  pageDefinition.createOrder.call(page)
  assert.equal(modals.length, 1)
  assert.equal(modals[0].content, '确认购买「测试商品」并支付？')
  modals[0].success({ confirm: true })

  assert.equal(page.data.purchasePending, true)
  assert.equal(pendingRequests[0].url, 'https://xixutech.cn/api/v1/idle/order')
  assert.deepEqual(pendingRequests[0].data, { productId: 12 })

  succeed(0, { id: 42, status: 0 })
  await flush()
  assert.equal(pendingRequests[1].url, 'https://xixutech.cn/api/v1/idle/order/42/pay')
  assert.deepEqual(pendingRequests[1].data, { subAppid: 'wx-test-app' })

  succeed(1, { paymentNo: 'P202609010001', payParams })
  await flush()
  assert.equal(paymentInvocations.length, 1)
  assert.equal(paymentInvocations[0].package, payParams.package)

  paymentInvocations[0].success({})
  await flush()
  assert.equal(pendingRequests[2].url, 'https://xixutech.cn/api/v1/payment/query/P202609010001')

  succeed(2, { transStat: 'S', businessProcessed: true })
  await flush()

  assert.equal(toasts.at(-1).title, '支付成功')
  assert.equal(page.data.purchasePending, false)
})

test('用户取消微信支付时保留待付款订单并允许重新购买', async function () {
  reset()
  const page = createPage()
  const purchase = pageDefinition.purchaseItem.call(page, { id: 12, title: '测试商品' })

  succeed(0, { id: 42, status: 0 })
  await flush()
  succeed(1, { paymentNo: 'P202609010002', payParams })
  await flush()
  paymentInvocations[0].fail({ errMsg: 'requestPayment:fail cancel' })
  await purchase

  assert.equal(pendingRequests.length, 2)
  assert.equal(toasts.at(-1).title, '已取消支付，可重新购买')
  assert.equal(page.data.purchasePending, false)
})

test('支付进行中时重复点击不会创建第二笔订单', async function () {
  reset()
  const page = createPage()
  const purchase = pageDefinition.purchaseItem.call(page, { id: 12, title: '测试商品' })
  const duplicate = pageDefinition.purchaseItem.call(page, { id: 12, title: '测试商品' })

  await duplicate
  assert.equal(pendingRequests.length, 1)

  pendingRequests[0].fail({ errMsg: 'network timeout' })
  await purchase
  assert.equal(page.data.purchasePending, false)
})
