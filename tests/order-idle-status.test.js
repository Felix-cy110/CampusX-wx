const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition

global.Page = function (definition) { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() {
    return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }
  }
}

require('../pages/order/order')

function map(status, side) {
  return pageDefinition.mapIdleOrder({
    id: 1,
    status,
    actualPaid: 10,
    productId: 2
  }, side || 'buy')
}

test('二手待付款订单展示去支付和取消操作', function () {
  const order = map(0, 'buy')
  assert.equal(order.showPayBtn, true)
  assert.equal(order.showCancelBtn, true)
  assert.equal(order.showConfirmBtn, false)
})

test('二手待收货订单展示确认收货和退款操作', function () {
  const order = map(2, 'buy')
  assert.equal(order.showConfirmBtn, true)
  assert.equal(order.showRefundBtn, true)
  assert.equal(order.showPayBtn, false)
})

test('二手退款申请只允许卖家处理', function () {
  const sellerOrder = map(5, 'sell')
  const buyerOrder = map(5, 'buy')
  assert.equal(sellerOrder.showRefundAgreeBtn, true)
  assert.equal(sellerOrder.showRefundRejectBtn, true)
  assert.equal(buyerOrder.showRefundAgreeBtn, false)
})
