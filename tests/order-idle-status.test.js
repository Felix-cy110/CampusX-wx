const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

let pageDefinition
let pendingRequests = []
let modals = []
let toasts = []
let loadingVisible = false

global.Page = function (definition) { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() {
    return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }
  },
  request(options) { pendingRequests.push(options) },
  showModal(options) { modals.push(options) },
  showToast(options) { toasts.push(options) },
  showLoading() { loadingVisible = true },
  hideLoading() { loadingVisible = false }
}

require('../pages/order/order')

test.beforeEach(function () {
  pendingRequests = []
  modals = []
  toasts = []
  loadingVisible = false
})

function map(status, side) {
  return pageDefinition.mapIdleOrder({
    id: 1,
    status,
    actualPaid: 10,
    productId: 2
  }, side || 'buy')
}

function createPage(status = 1, side = 'sell') {
  const orders = [map(status, side)]
  return Object.assign({}, pageDefinition, {
    data: Object.assign({}, pageDefinition.data, {
      currentTab: 'secondhand',
      currentSide: side,
      orders,
      filteredOrders: orders
    }),
    setData(updates) { Object.assign(this.data, updates) }
  })
}

function shipEvent(type = 'secondhand') {
  return { currentTarget: { dataset: { id: 1, type } } }
}

function receiptEvent() {
  return { currentTarget: { dataset: { id: 1, type: 'secondhand', side: 'buy' } } }
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

for (const scenario of [
  { name: '同意后立即退款成功', handler: 'onRefundAgree', status: 4, reason: '卖方同意退款', label: '已取消' },
  { name: '同意后退款在途', handler: 'onRefundAgree', status: 5, reason: '卖方同意退款', label: '退款处理中' },
  { name: '拒绝后等待管理员', handler: 'onRefundReject', status: 5, reason: '卖方拒绝退款：无', label: '待管理员处理' }
]) {
  test(`Mock完整退款流程：买家申请→卖家${scenario.name}→双方重新进入`, async function () {
    // Mock wx.request 边界，执行真实 Page 方法和请求封装，不访问线上资金接口。
    let savedOrder = { id: 1, productId: 2, actualPaid: 10, status: 2, statusDesc: '待收货' }
    const buyer = createPage(2, 'buy')
    buyer.onApplyRefund(shipEvent())
    const application = modals[0].success({ confirm: true })
    assert.equal(pendingRequests[0].method, 'POST')
    assert.match(pendingRequests[0].url, /\/idle\/order\/1\/refund-apply$/)
    savedOrder = { ...savedOrder, status: 5, statusDesc: '退款申请中', cancelReason: '买家申请退款' }
    succeed(0, null)
    await application
    succeed(1, { list: [savedOrder] })
    await flush()
    assert.equal(buyer.data.filteredOrders[0].showRefundBtn, false)

    const seller = createPage(5, 'sell')
    const initialLoad = seller.loadOrders()
    succeed(2, { list: [savedOrder] })
    await initialLoad
    assert.equal(seller.data.filteredOrders[0].showRefundAgreeBtn, true)
    assert.equal(seller.data.filteredOrders[0].showRefundRejectBtn, true)
    const decision = seller[scenario.handler](shipEvent())
    modals[1].success({ confirm: true })
    await flush()
    assert.equal(loadingVisible, true)
    assert.equal(pendingRequests[3].method, 'PUT')
    assert.match(pendingRequests[3].url, scenario.handler === 'onRefundAgree' ? /\/refund-agree$/ : /\/refund-reject$/)
    for (let click = 0; click < 5; click++) {
      await seller.onRefundAgree(shipEvent())
      await seller.onRefundReject(shipEvent())
    }
    assert.equal(pendingRequests.length, 4)
    assert.equal(modals.length, 2)

    savedOrder = { ...savedOrder, status: scenario.status, cancelReason: scenario.reason,
      statusDesc: scenario.status === 4 ? '已取消' : '退款申请中' }
    succeed(3, null)
    await flush()
    assert.equal(loadingVisible, false)
    succeed(4, { list: [savedOrder] })
    await decision
    assert.equal(seller.data.filteredOrders[0].status, scenario.label)
    assert.equal(seller.data.refundOrderId, '')

    for (const side of ['buy', 'sell']) {
      const reopened = createPage(5, side)
      reopened.onShow()
      succeed(pendingRequests.length - 1, { list: [savedOrder] })
      await flush()
      const order = reopened.data.filteredOrders[0]
      assert.equal(order.status, scenario.label)
      assert.equal(order.showRefundBtn, false)
      assert.equal(order.showRefundAgreeBtn, false)
      assert.equal(order.showRefundRejectBtn, false)
      await reopened.onRefundAgree(shipEvent())
      await reopened.onRefundReject(shipEvent())
    }
    assert.equal(pendingRequests.length, 7)
    assert.equal(modals.length, 2)
  })
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

test('Mock买家退款到账后重新进入：以真实退款结果覆盖旧申请状态', async function () {
  const page = createPage(5, 'buy')
  const initial = page.loadOrders()
  succeed(0, { list: [{ id: 1, status: 5, statusDesc: '退款申请中', refundStatus: 'P' }] })
  await initial
  assert.equal(page.data.filteredOrders[0].status, '退款处理中')
  page.onShow()
  succeed(1, { list: [{ id: 1, status: 4, statusDesc: '已退款', refundStatus: 'S', cancelReason: '卖方同意退款' }] })
  await flush()
  assert.equal(page.data.filteredOrders[0].status, '已退款')
  assert.match(page.data.filteredOrders[0].remark, /原路退回/)
  assert.equal(page.data.filteredOrders[0].showRefundBtn, false)
  for (const side of ['buy', 'sell']) {
    const order = pageDefinition.mapIdleOrder({ id: 1, status: 5, statusDesc: '退款申请中', refundStatus: 'S' }, side)
    assert.equal(order.status, '已退款')
    assert.equal(order.showRefundAgreeBtn, false)
    assert.equal(order.showRefundRejectBtn, false)
  }
})

test('退款失败不会被旧的同意退款原因误判为到账或仍在处理中', function () {
  const order = pageDefinition.mapIdleOrder({ status: 5, refundStatus: 'F', cancelReason: '卖方同意退款' }, 'buy')
  assert.equal(order.status, '退款失败')
  assert.match(order.remark, /联系平台/)
})

for (const [handler, endpoint, reason, status] of [
  ['onRefundAgree', 'refund-agree', '卖方同意退款', '退款处理中'],
  ['onRefundReject', 'refund-reject', '卖方拒绝退款：无', '待管理员处理']
]) {
  test(`${handler}提交期间互斥，成功后及重新进入均不再显示处理按钮`, async function () {
    const page = createPage(5)
    const action = page[handler](shipEvent())
    await page.onRefundAgree(shipEvent())
    await page.onRefundReject(shipEvent())
    assert.equal(modals.length, 1)
    modals[0].success({ confirm: true })
    await flush()
    assert.equal(pendingRequests[0].url, `https://xixutech.cn/api/v1/idle/order/1/${endpoint}`)
    assert.equal(pendingRequests[0].method, 'PUT')
    await page.onRefundAgree(shipEvent())
    await page.onRefundReject(shipEvent())
    assert.equal(pendingRequests.length, 1)
    assert.equal(toasts.length, 0)
    succeed(0, null)
    await flush()
    assert.equal(page.data.filteredOrders[0].showRefundAgreeBtn, false)
    assert.equal(page.data.filteredOrders[0].status, status)
    assert.equal(page.data.refundOrderId, '1')
    const savedOrder = { id: 1, status: 5, statusDesc: '退款申请中', cancelReason: reason }
    succeed(1, { list: [savedOrder] })
    await action
    assert.equal(page.data.refundOrderId, '')
    await page.onRefundAgree(shipEvent())
    await page.onRefundReject(shipEvent())
    assert.equal(modals.length, 1)

    const reopened = createPage(5)
    const reload = reopened.loadOrders()
    succeed(2, { list: [savedOrder] })
    await reload
    assert.equal(reopened.data.filteredOrders[0].status, status)
    assert.equal(reopened.data.filteredOrders[0].showRefundAgreeBtn, false)
    assert.equal(reopened.data.filteredOrders[0].showRefundRejectBtn, false)
  })

  test(`${handler}失败明确提示且允许重试`, async function () {
    const page = createPage(5)
    const action = page[handler](shipEvent())
    modals[0].success({ confirm: true })
    await flush()
    pendingRequests[0].success({ data: { code: 500, message: '退款服务暂不可用' } })
    await action
    assert.deepEqual(toasts, [{ title: '退款服务暂不可用', icon: 'none' }])
    assert.equal(page.data.refundOrderId, '')
    assert.equal(page.data.filteredOrders[0].showRefundAgreeBtn, true)
    const retry = page[handler](shipEvent())
    modals[1].success({ confirm: false })
    await retry
    assert.equal(pendingRequests.length, 1)
    assert.equal(page.data.refundOrderId, '')
  })
}

test('退款完成后不展示处理入口，买卖双方均能看到退款处理中或待管理员处理', function () {
  for (const side of ['buy', 'sell']) {
    for (const reason of ['卖方同意退款', '管理员同意退款', '卖方拒绝退款：无']) {
      const order = pageDefinition.mapIdleOrder({ id: 1, status: 5, cancelReason: reason }, side)
      assert.equal(order.showRefundAgreeBtn, false)
      assert.equal(order.showRefundRejectBtn, false)
      assert.ok(order.remark)
    }
    assert.equal(map(4, side).showRefundAgreeBtn, false)
    assert.equal(map(4, side).showRefundRejectBtn, false)
  }
})

test('退款操作后的新列表不会被较早返回的旧列表覆盖', async function () {
  const page = createPage(5)
  const oldLoad = page.loadOrders()
  const action = page.onRefundReject(shipEvent())
  modals[0].success({ confirm: true })
  await flush()
  succeed(1, null)
  await flush()
  succeed(2, { list: [{ id: 1, status: 5, cancelReason: '卖方拒绝退款：无' }] })
  await action
  succeed(0, { list: [{ id: 1, status: 5, cancelReason: '买家申请退款' }] })
  await oldLoad
  assert.equal(page.data.filteredOrders[0].status, '待管理员处理')
  assert.equal(page.data.filteredOrders[0].showRefundAgreeBtn, false)
})

test('退款弹窗打开失败或网络超时均释放锁并显示失败提示', async function () {
  const page = createPage(5)
  const first = page.onRefundAgree(shipEvent())
  modals[0].fail({ errMsg: 'showModal:fail' })
  await first
  assert.equal(page.data.refundOrderId, '')
  assert.equal(toasts[0].icon, 'none')
  const second = page.onRefundReject(shipEvent())
  modals[1].success({ confirm: true })
  await flush()
  pendingRequests[0].fail({ errMsg: 'request:fail timeout' })
  await second
  assert.equal(page.data.refundOrderId, '')
  assert.match(toasts[1].title, /超时/)
  assert.equal(page.data.filteredOrders[0].showRefundRejectBtn, true)
})

test('确认发货入口仅展示给待发货订单的卖家', function () {
  for (const status of [0, 1, 2, 3, 4, 5]) {
    for (const side of ['buy', 'sell']) {
      assert.equal(map(status, side).showShipBtn, status === 1 && side === 'sell')
    }
  }
  const template = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')
  assert.match(template, /class="action-btn-group" wx:if="\{\{item\.showShipBtn \|\|/)
  assert.match(template, /wx:if="\{\{item\.showShipBtn\}\}" catchtap="onShipOrder" data-id="\{\{item\.id\}\}" data-type="\{\{item\.type\}\}"/)
})

test('待发货提示卖家确认截止时间和超时自动退款规则', function () {
  const order = pageDefinition.mapIdleOrder({
    id: 1,
    status: 1,
    sellerConfirmExpireTime: '2026-09-09T12:26:00'
  }, 'sell')
  assert.match(order.remark, /2026-09-09 12:26:00/)
  assert.match(order.remark, /超时将自动退款/)
  assert.match(map(1, 'sell').remark, /付款后48小时内/)
  assert.match(map(1, 'buy').remark, /等待卖家发货/)
})

test('卖家确认后调用发货接口并刷新为待收货，过程中禁止重复提交', async function () {
  const page = createPage()
  const action = page.onShipOrder(shipEvent())
  await page.onShipOrder(shipEvent())
  assert.equal(modals.length, 1)
  assert.equal(pendingRequests.length, 0)
  assert.match(modals[0].content, /已经发出，或已当面交给买家/)
  modals[0].success({ confirm: true })
  await flush()

  assert.equal(pendingRequests.length, 1)
  assert.equal(pendingRequests[0].url, 'https://xixutech.cn/api/v1/idle/order/1/ship')
  assert.equal(pendingRequests[0].method, 'PUT')
  assert.equal(toasts.length, 0)
  await page.onShipOrder(shipEvent())
  assert.equal(pendingRequests.length, 1)

  succeed(0, null)
  await flush()
  assert.equal(toasts.at(-1).title, '已确认发货')
  assert.equal(pendingRequests[1].url, 'https://xixutech.cn/api/v1/idle/order/seller-list')
  assert.equal(page.data.shippingOrderId, '1')

  succeed(1, { list: [{ id: 1, status: 2, statusDesc: '待收货' }] })
  await action
  assert.equal(page.data.shippingOrderId, '')
  assert.equal(page.data.filteredOrders[0].showShipBtn, false)
  assert.equal(page.data.filteredOrders[0].status, '待收货')
  assert.match(page.data.filteredOrders[0].remark, /等待买家确认收货/)
  assert.equal(map(2, 'buy').showConfirmBtn, true)
})

test('卖家取消确认弹窗时不发请求并允许重新操作', async function () {
  const page = createPage()
  const action = page.onShipOrder(shipEvent())
  modals[0].success({ confirm: false })
  await action

  assert.equal(pendingRequests.length, 0)
  assert.equal(toasts.length, 0)
  assert.equal(page.data.shippingOrderId, '')
  const retry = page.onShipOrder(shipEvent())
  assert.equal(modals.length, 2)
  modals[1].success({ confirm: false })
  await retry
})

test('非卖家待发货订单和其它业务不会触发发货请求', async function () {
  for (const [status, side] of [[1, 'buy'], [0, 'sell'], [2, 'sell'], [4, 'sell']]) {
    await createPage(status, side).onShipOrder(shipEvent())
  }
  await createPage().onShipOrder(shipEvent('rental'))
  assert.equal(modals.length, 0)
  assert.equal(pendingRequests.length, 0)
})

test('发货接口业务失败时保留待发货状态并展示服务端原因', async function () {
  const page = createPage()
  const action = page.onShipOrder(shipEvent())
  modals[0].success({ confirm: true })
  await flush()
  pendingRequests[0].success({ data: { code: 500, message: '订单不是待发货状态' } })
  await action

  assert.equal(pendingRequests.length, 1)
  assert.deepEqual(toasts, [{ title: '订单不是待发货状态', icon: 'none' }])
  assert.equal(page.data.filteredOrders[0].showShipBtn, true)
  assert.equal(page.data.shippingOrderId, '')
})

test('发货请求网络失败时不会假报成功并释放提交锁', async function () {
  const page = createPage()
  const action = page.onShipOrder(shipEvent())
  modals[0].success({ confirm: true })
  await flush()
  pendingRequests[0].fail({ errMsg: 'request:fail timeout' })
  await action

  assert.equal(pendingRequests.length, 1)
  assert.equal(toasts[0].icon, 'none')
  assert.match(toasts[0].title, /超时/)
  assert.equal(page.data.filteredOrders[0].showShipBtn, true)
  assert.equal(page.data.shippingOrderId, '')
})

test('确认弹窗打开失败时释放提交锁', async function () {
  const page = createPage()
  const action = page.onShipOrder(shipEvent())
  modals[0].fail({ errMsg: 'showModal:fail' })
  await action

  assert.equal(pendingRequests.length, 0)
  assert.equal(toasts[0].icon, 'none')
  assert.equal(page.data.shippingOrderId, '')
})

test('Mock买卖双方完整交付流程：待发货→卖家发货→买家收货→已完成', async function () {
  // 只通过 wx.request mock 响应驱动真实 Page 方法及 request 包装器，不连接服务端。
  const order = {
    id: 1,
    orderNo: 'IDLE-MOCK-20260905',
    productId: 2,
    productTitle: '测试商品',
    actualPaid: 1,
    status: 1,
    statusDesc: '待发货',
    sellerConfirmExpireTime: '2026-09-07T12:26:00'
  }
  const sellerPage = createPage(1, 'sell')
  const sellerLoad = sellerPage.loadOrders()
  assert.equal(pendingRequests[0].url, 'https://xixutech.cn/api/v1/idle/order/seller-list')
  assert.equal(pendingRequests[0].method, 'GET')
  succeed(0, { list: [order] })
  await sellerLoad

  assert.equal(sellerPage.data.filteredOrders[0].showShipBtn, true)
  assert.equal(sellerPage.data.filteredOrders[0].showConfirmBtn, false)
  assert.match(sellerPage.data.filteredOrders[0].remark, /2026-09-07 12:26:00/)

  const shipment = sellerPage.onShipOrder(shipEvent())
  modals[0].success({ confirm: true })
  await flush()
  assert.equal(pendingRequests[1].url, 'https://xixutech.cn/api/v1/idle/order/1/ship')
  assert.equal(pendingRequests[1].method, 'PUT')
  assert.equal(pendingRequests[1].header.Authorization, 'Bearer test-token')
  assert.equal(sellerPage.data.filteredOrders[0].status, '待发货')
  assert.equal(toasts.length, 0)

  succeed(1, null)
  await flush()
  assert.equal(pendingRequests[2].url, 'https://xixutech.cn/api/v1/idle/order/seller-list')
  const shippedOrder = { ...order, status: 2, statusDesc: '待收货' }
  succeed(2, { list: [shippedOrder] })
  await shipment
  assert.equal(sellerPage.data.filteredOrders[0].status, '待收货')
  assert.equal(sellerPage.data.filteredOrders[0].showShipBtn, false)
  assert.equal(sellerPage.data.filteredOrders[0].showConfirmBtn, false)
  assert.equal(sellerPage.data.shippingOrderId, '')

  const buyerPage = createPage(1, 'buy')
  const buyerLoad = buyerPage.loadOrders()
  assert.equal(pendingRequests[3].url, 'https://xixutech.cn/api/v1/idle/order/buyer-list')
  succeed(3, { list: [shippedOrder] })
  await buyerLoad
  assert.equal(buyerPage.data.filteredOrders[0].showConfirmBtn, true)
  assert.equal(buyerPage.data.filteredOrders[0].showShipBtn, false)

  buyerPage.onConfirmReceipt(receiptEvent())
  assert.equal(modals.length, 2)
  assert.match(modals[1].content, /已经收到货物/)
  const confirmation = modals[1].success({ confirm: true })
  assert.equal(pendingRequests[4].url, 'https://xixutech.cn/api/v1/idle/order/1/confirm')
  assert.equal(pendingRequests[4].method, 'PUT')
  assert.equal(buyerPage.data.filteredOrders[0].status, '待收货')
  assert.deepEqual(toasts.map(toast => toast.title), ['已确认发货'])

  // 后端明确完成分账后返回成功；前端仍须回查列表才能显示已完成。
  succeed(4, null)
  await confirmation
  assert.equal(pendingRequests[5].url, 'https://xixutech.cn/api/v1/idle/order/buyer-list')
  assert.equal(buyerPage.data.filteredOrders[0].status, '待收货')
  succeed(5, { list: [{ ...shippedOrder, status: 3, statusDesc: '已完成' }] })
  await flush()

  const completed = buyerPage.data.filteredOrders[0]
  assert.equal(completed.status, '已完成')
  assert.equal(completed.showConfirmBtn, false)
  assert.equal(completed.showShipBtn, false)
  assert.equal(completed.showRefundBtn, false)
  assert.equal(buyerPage.data.loading, false)
  assert.deepEqual(toasts.map(toast => toast.title), ['已确认发货', '操作成功'])
  assert.equal(pendingRequests.length, 6)
})

for (const [scenario, message] of [
  ['失败', '分账未明确成功，已保存等待对账: 汇付分账确认失败'],
  ['处理中', '分账请求已存在，当前状态=P，等待对账']
]) {
  test(`确认收货返回分账${scenario}时不假报成功、不将订单标为完成`, async function () {
    const page = createPage(2, 'buy')
    const order = pageDefinition.mapIdleOrder({ id: 1, status: 2, statusDesc: '待收货' }, 'buy')
    page.setData({ orders: [order], filteredOrders: [order] })
    page.onConfirmReceipt(receiptEvent())
    const confirmation = modals[0].success({ confirm: true })

    assert.equal(pendingRequests.length, 1)
    assert.equal(pendingRequests[0].url, 'https://xixutech.cn/api/v1/idle/order/1/confirm')
    assert.equal(pendingRequests[0].method, 'PUT')
    assert.equal(toasts.length, 0)
    pendingRequests[0].success({ data: { code: 3103, message } })
    await confirmation

    assert.deepEqual(toasts, [{ title: message, icon: 'none' }])
    assert.equal(page.data.filteredOrders[0].status, '待收货')
    assert.equal(page.data.filteredOrders[0].showConfirmBtn, true)
    assert.equal(pendingRequests.length, 1)
  })
}

test('确认收货请求超时时保留待收货状态并显示超时提示', async function () {
  const page = createPage(2, 'buy')
  page.onConfirmReceipt(receiptEvent())
  const confirmation = modals[0].success({ confirm: true })
  pendingRequests[0].fail({ errMsg: 'request:fail timeout' })
  await confirmation

  assert.equal(pendingRequests.length, 1)
  assert.equal(toasts.length, 1)
  assert.equal(toasts[0].icon, 'none')
  assert.match(toasts[0].title, /超时/)
  assert.equal(page.data.filteredOrders[0].showConfirmBtn, true)
})

test('买家取消确认收货弹窗时不发起收货或分账请求', async function () {
  const page = createPage(2, 'buy')
  page.onConfirmReceipt(receiptEvent())
  await modals[0].success({ confirm: false })

  assert.equal(pendingRequests.length, 0)
  assert.equal(toasts.length, 0)
  assert.equal(page.data.filteredOrders[0].showConfirmBtn, true)
})
