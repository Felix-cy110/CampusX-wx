const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

let definition
let requests
let modals
let toasts
let payments
let loading
let navigations
const app = { globalData: { isLoggedIn: true, isJoinedSchool: true, userInfo: { uid: '7' } } }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/index/index' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => key === 'token' ? 'test-token' : '',
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
  getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32, left: 290 }),
  request: options => requests.push(options),
  requestPayment: options => payments.push(options),
  showModal: options => modals.push(options),
  showToast: options => toasts.push(options),
  showLoading: () => { loading = true },
  hideLoading: () => { loading = false },
  navigateTo(options) {
    navigations.push(options)
    if (options.success) options.success({})
  }
}
require('../pages/index/index')
const indexDefinition = definition
require('../pages/errand-detail/errand-detail')
const detailDefinition = definition
require('../pages/order/order')
const template = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')
const orderId = '9007199254740993'
const descriptions = ['待需求方确认', '待买方付款', '待卖方缴押金', '代课中', '待买方确认', '已完成', '已取消', '违约申诉']

test.beforeEach(() => {
  requests = []
  modals = []
  toasts = []
  payments = []
  loading = false
  navigations = []
})

function orderVO(status, extra = {}) {
  return {
    orderId, demandId: 17, status, statusDesc: descriptions[status + 1],
    courseName: '测试跑腿', counterpartyNickname: '测试用户', fee: 10,
    classTime: '2099-09-19T17:09:00', ...extra
  }
}

function createPage(status = -1, side = 'buy') {
  const page = {
    ...definition,
    data: { ...structuredClone(definition.data), currentTab: 'errand', currentSide: side },
    setData(updates) { Object.assign(this.data, updates) }
  }
  const orders = [page.mapProxyOrder(orderVO(status), side)]
  page.setData({ orders, filteredOrders: orders })
  return page
}

function evaluate(expression, page, item) {
  return vm.runInNewContext(expression, { ...page.data, item })
}

// 从真实 WXML 读取操作区及按钮条件，验证按钮能被看到且事件绑定正确。
function visibleActions(page, item = page.data.filteredOrders[0]) {
  const group = template.match(/<view class="action-btn-group" wx:if="\{\{(.*?)\}\}">/)
  if (!evaluate(group[1], page, item)) return []
  return [...template.matchAll(/<view\b[^>]*catchtap="(\w+)"[^>]*>/g)]
    .filter(match => {
      const condition = match[0].match(/wx:if="\{\{(.*?)\}\}"/)
      return !condition || evaluate(condition[1], page, item)
    }).map(match => match[1]).sort()
}

function actionEvent(page, handler) {
  const node = template.match(new RegExp('<view\\b[^>]*catchtap="' + handler + '"[^>]*>'))
  assert.ok(node, '缺少按钮绑定：' + handler)
  const item = page.data.filteredOrders[0]
  assert.ok(visibleActions(page).includes(handler), '当前状态必须能看到该按钮')
  const dataset = {}
  for (const binding of node[0].matchAll(/data-([\w-]+)="\{\{item\.(\w+)\}\}"/g)) {
    dataset[binding[1]] = item[binding[2]]
  }
  return { currentTarget: { dataset } }
}

function succeed(index, data) {
  requests[index].success({ data: { code: 200, data } })
}

function requestPath(index) {
  return new URL(requests[index].url).pathname
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

async function refresh(page, status) {
  const index = requests.length
  const result = page.loadOrders()
  assert.equal(requestPath(index), '/api/v1/proxy-class-order/my-list')
  assert.equal(requests[index].data.role, page.data.currentSide === 'buy' ? 1 : 2)
  succeed(index, { list: [orderVO(status)] })
  await result
}

const expectedActions = [
  [-1, ['onConfirmMatch'], []],
  [0, ['onCancelOrder', 'onPayOrder'], []],
  [1, ['onCancelOrder'], ['onPayDeposit']],
  [2, ['onCancelOrder'], ['onConfirmReceipt']],
  [3, ['onCancelOrder', 'onConfirmReceipt'], []],
  [4, [], []], [5, [], []], [6, [], []], [99, [], []], [null, [], []]
]
for (const [status, buyerActions, sellerActions] of expectedActions) {
  test(`跑腿状态 ${status} 的实际按钮只向允许操作的角色展示`, () => {
    assert.deepEqual(visibleActions(createPage(status, 'buy')), buyerActions)
    assert.deepEqual(visibleActions(createPage(status, 'sell')), sellerActions)
  })
}

test('跑腿角色标签与列表查询角色一致，二手和租赁标签保持正确', async () => {
  const labels = [...template.matchAll(/<text class="side-label">\{\{(.*?)\}\}<\/text>/g)]
  for (const [tab, expected] of [
    ['errand', ['我的挂单', '我的接单']],
    ['secondhand', ['我买到的', '我卖出的']],
    ['rental', ['我租到的', '我租出的']]
  ]) {
    const page = createPage()
    page.data.currentTab = tab
    assert.deepEqual(labels.map(match => evaluate(match[1], page)), expected)
  }
  await refresh(createPage(-1, 'buy'), -1)
  await refresh(createPage(-1, 'sell'), -1)
  const tag = template.match(/<text class="side-tag-text">\{\{(.*?)\}\}<\/text>/)[1]
  const buyer = createPage()
  const seller = createPage(-1, 'sell')
  assert.equal(evaluate(tag, buyer, buyer.data.orders[0]), '发布')
  assert.equal(evaluate(tag, seller, seller.data.orders[0]), '接单')
})

test('跑腿开始后不显示取消按钮，兼容后端数组和字符串时间', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 19, 17, 0).getTime() })
  const page = createPage()
  for (const classTime of [[2026, 9, 19, 16, 59], [2026, 9, 19, 17, 0], '2026-09-19T17:00:00', '2026-09-19 16:59:00']) {
    for (const status of [0, 1, 2, 3]) {
      const item = page.mapProxyOrder(orderVO(status, { classTime }), 'buy')
      assert.equal(visibleActions(page, item).includes('onCancelOrder'), false)
    }
  }
  for (const classTime of [[2026, 9, 19, 17, 1], '2026-09-19 17:01:00', null]) {
    const item = page.mapProxyOrder(orderVO(0, { classTime }), 'buy')
    assert.equal(visibleActions(page, item).includes('onCancelOrder'), true)
  }
})

test('发布者确认发送原始订单 ID，后端成功后显示付款按钮，弹窗和请求期间防连点', async () => {
  const page = createPage()
  const event = actionEvent(page, 'onConfirmMatch')
  const confirmation = page.onConfirmMatch(event)
  await page.onConfirmMatch(event)
  assert.equal(modals.length, 1)
  assert.match(modals[0].content, /测试用户.*测试跑腿.*30分钟/)
  assert.equal(requests.length, 0)
  modals[0].success({ confirm: true })
  await flush()
  assert.equal(requestPath(0), '/api/v1/proxy-class-order/confirm-match')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].data, { orderId })
  assert.equal(requests[0].header.Authorization, 'Bearer test-token')
  assert.equal(loading, true)
  assert.equal(toasts.length, 0)
  await page.onConfirmMatch(event)
  assert.equal(requests.length, 1)
  succeed(0, null)
  await flush()
  assert.equal(page.data.filteredOrders[0].showMatchBtn, false)
  await page.onConfirmMatch(event)
  assert.equal(requestPath(1), '/api/v1/proxy-class-order/my-list')
  succeed(1, { list: [orderVO(0)] })
  await confirmation
  assert.deepEqual(visibleActions(page), ['onCancelOrder', 'onPayOrder'])
  assert.equal(page.data.matchingOrderId, '')
  assert.equal(loading, false)
  await page.onConfirmMatch(event)
  assert.equal(requests.length, 2)
})

for (const failure of ['取消', '弹窗失败', '业务拒绝', '网络超时']) {
  test(`确认接单人${failure}时不假报成功，保留申请并允许重试`, async () => {
    const page = createPage()
    const event = actionEvent(page, 'onConfirmMatch')
    const confirmation = page.onConfirmMatch(event)
    if (failure === '取消') modals[0].success({ confirm: false })
    else if (failure === '弹窗失败') modals[0].fail({ errMsg: 'showModal:fail' })
    else {
      modals[0].success({ confirm: true })
      await flush()
      if (failure === '业务拒绝') requests[0].success({ data: { code: 2606, message: '订单状态不允许确认' } })
      else requests[0].fail({ errMsg: 'request:fail timeout' })
    }
    await confirmation
    assert.deepEqual(visibleActions(page), ['onConfirmMatch'])
    assert.equal(page.data.matchingOrderId, '')
    assert.equal(loading, false)
    assert.equal(toasts.some(toast => toast.title === '已确认，请继续付款'), false)
    if (failure === '业务拒绝') assert.equal(toasts[0].title, '订单状态不允许确认')
    if (failure === '网络超时') assert.match(toasts[0].title, /超时/)
    const retry = page.onConfirmMatch(event)
    assert.equal(modals.length, 2)
    modals[1].success({ confirm: false })
    await retry
  })
}

test('接单者、非待确认订单及其他业务不能调用发布者确认接口', async () => {
  for (const [status, side, type] of [[-1, 'sell', 'errand'], [0, 'buy', 'errand'], [-1, 'buy', 'secondhand']]) {
    const page = createPage(status, side)
    await page.onConfirmMatch({ currentTarget: { dataset: { id: orderId, type } } })
  }
  assert.equal(modals.length, 0)
  assert.equal(requests.length, 0)
})

test('确认成功后较早返回的列表不能恢复待确认入口', async () => {
  const page = createPage()
  const oldLoad = page.loadOrders()
  const confirmation = page.onConfirmMatch(actionEvent(page, 'onConfirmMatch'))
  modals[0].success({ confirm: true })
  await flush()
  succeed(1, null)
  await flush()
  succeed(2, { list: [orderVO(0)] })
  await confirmation
  succeed(0, { list: [orderVO(-1)] })
  await oldLoad
  assert.deepEqual(visibleActions(page), ['onCancelOrder', 'onPayOrder'])
})

test('确认成功但刷新失败时保留订单与付款入口，重试成功后清除错误', async () => {
  const page = createPage()
  const confirmation = page.onConfirmMatch(actionEvent(page, 'onConfirmMatch'))
  modals[0].success({ confirm: true })
  await flush()
  succeed(0, null)
  await flush()
  requests[1].fail({ errMsg: 'request:fail timeout' })
  await confirmation
  assert.equal(page.data.orders.length, 1)
  assert.equal(page.data.orders[0].id, orderId)
  assert.equal(page.data.orders[0].status, '待买方付款')
  assert.equal(page.data.orders[0].priceText, '10.00')
  assert.deepEqual(visibleActions(page), ['onCancelOrder', 'onPayOrder'])
  assert.match(page.data.loadError, /刷新失败/)
  assert.equal(page.data.loading, false)
  assert.equal(page.data.matchingOrderId, '')
  assert.match(template, /class="load-error"[^>]*bindtap="loadOrders"/)

  await refresh(page, 0)
  assert.equal(page.data.loadError, '')
  await pay(page, 'onPayOrder', 'pay', 1)
  assert.equal(page.data.orders[0].status, '待卖方缴押金')
})

test('全部订单刷新中跑腿请求失败时，保留跑腿并更新成功的其他模块', async () => {
  const page = createPage(0)
  page.data.currentTab = 'all'
  const refreshing = page.loadOrders()
  succeed(0, { list: [{ id: 12, status: 0, actualPaid: 20 }] })
  succeed(1, { list: [] })
  requests[2].fail({ errMsg: 'request:fail timeout' })
  await refreshing
  assert.deepEqual(page.data.orders.map(item => item.type), ['secondhand', 'errand'])
  assert.equal(page.data.orders[1].id, orderId)
  assert.equal(page.data.orders[1].showPayBtn, true)
  assert.match(page.data.loadError, /刷新失败/)
})

test('切换角色后请求失败不会把发布者订单展示为接单者订单', async () => {
  const page = createPage(0, 'buy')
  page.data.currentSide = 'sell'
  const refreshing = page.loadOrders()
  requests[0].fail({ errMsg: 'request:fail timeout' })
  await refreshing
  assert.deepEqual(page.data.orders, [])
  assert.match(page.data.loadError, /刷新失败/)
})

test('旧列表请求失败不覆盖较新的成功列表，也不显示过时的错误', async () => {
  const page = createPage(-1)
  const oldLoad = page.loadOrders()
  await refresh(page, 0)
  requests[0].fail({ errMsg: 'request:fail timeout' })
  await oldLoad
  assert.equal(page.data.orders[0].status, '待买方付款')
  assert.equal(page.data.loadError, '')
})

test('跑腿接口成功返回空列表时清空旧订单，不误认为刷新失败', async () => {
  const page = createPage(0)
  const refreshing = page.loadOrders()
  succeed(0, { list: [] })
  await refreshing
  assert.deepEqual(page.data.orders, [])
  assert.equal(page.data.loadError, '')
})

async function pay(page, handler, endpoint, nextStatus) {
  const index = requests.length
  const paymentIndex = payments.length
  const result = page[handler](actionEvent(page, handler))
  assert.equal(requestPath(index), '/api/v1/proxy-class-order/' + endpoint)
  assert.equal(requests[index].method, 'POST')
  assert.deepEqual(requests[index].data, { orderId, subAppid: 'wx-test-app' })
  succeed(index, { paymentNo: 'PAY-' + endpoint, payParams: {
    timeStamp: '123', nonceStr: 'nonce', package: 'prepay_id=test', signType: 'RSA', paySign: 'signature'
  } })
  await flush()
  assert.equal(payments.length, paymentIndex + 1)
  payments[paymentIndex].success({})
  await flush()
  assert.equal(requestPath(index + 1), '/api/v1/payment/query/PAY-' + endpoint)
  succeed(index + 1, { transStat: 'S', notifyStatus: 2 })
  await flush()
  assert.equal(requestPath(index + 2), '/api/v1/proxy-class-order/my-list')
  succeed(index + 2, { list: [orderVO(nextStatus)] })
  await result
}

async function applyFromEntry(entry) {
  const pageDefinition = entry === '列表' ? indexDefinition : detailDefinition
  const page = {
    ...pageDefinition,
    data: structuredClone(pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) }
  }
  const demand = { id: 17, userId: 8, courseName: '测试跑腿', fee: 10, classTime: [2099, 9, 19, 17, 9] }
  const index = requests.length
  if (entry === '列表') {
    const loadingList = page.loadErrands()
    assert.equal(requestPath(index), '/api/v1/proxy-class-demand/list')
    succeed(index, { list: [demand] })
    await loadingList
  } else {
    page.onLoad({ id: '17' })
    assert.equal(requestPath(index), '/api/v1/proxy-class-demand/17')
    succeed(index, demand)
    await flush()
  }
  const application = entry === '列表'
    ? page.grabErrand({ currentTarget: { dataset: { id: '17' } } })
    : page.applyOrder()
  modals.at(-1).success({ confirm: true })
  await flush()
  assert.equal(requestPath(index + 1), '/api/v1/proxy-class-order/apply')
  assert.deepEqual(requests[index + 1].data, { demandId: 17 })
  succeed(index + 1, orderId)
  await application
  const target = new URL(navigations.at(-1).url, 'https://mini-program.test')
  assert.equal(target.pathname, '/pages/order/order')
  const seller = createPage(-1, 'sell')
  seller.onLoad(Object.fromEntries(target.searchParams))
  assert.equal(seller.data.currentTab, 'errand')
  assert.equal(seller.data.currentSide, 'sell')
  assert.equal(requestPath(index + 2), '/api/v1/proxy-class-order/my-list')
  assert.equal(requests[index + 2].data.role, 2)
  succeed(index + 2, { list: [orderVO(-1)] })
  await flush()
  assert.equal(seller.data.orders[0].status, '待需求方确认')
  return seller
}

for (const entry of ['列表', '详情页']) {
test(`${entry}完整 Mock 流程：申请→确认接单→付款→缴押金→标记完成→确认完成`, async () => {
  // 仅模拟网络和微信支付边界，执行实际 Page、请求封装、支付轮询及 WXML 绑定。
  const seller = await applyFromEntry(entry)
  const buyer = createPage()
  await refresh(buyer, -1)
  const confirmIndex = requests.length
  const confirmation = buyer.onConfirmMatch(actionEvent(buyer, 'onConfirmMatch'))
  modals.at(-1).success({ confirm: true })
  await flush()
  succeed(confirmIndex, null)
  await flush()
  succeed(confirmIndex + 1, { list: [orderVO(0)] })
  await confirmation
  await pay(buyer, 'onPayOrder', 'pay', 1)
  await refresh(seller, 1)
  await pay(seller, 'onPayDeposit', 'deposit-pay', 2)

  for (const [page, endpoint, nextStatus, expectedLabel] of [
    [seller, 'mark-complete', 3, '标记完成'],
    [buyer, 'confirm-complete', 4, '确认完成']
  ]) {
    if (page === buyer) await refresh(page, 3)
    const label = template.match(/catchtap="onConfirmReceipt"[^>]*>\{\{(.*?)\}\}<\/view>/)[1]
    assert.equal(evaluate(label, page, page.data.orders[0]), expectedLabel)
    const index = requests.length
    page.onConfirmReceipt(actionEvent(page, 'onConfirmReceipt'))
    const completion = modals.at(-1).success({ confirm: true })
    assert.equal(requestPath(index), `/api/v1/proxy-class-order/${orderId}/${endpoint}`)
    assert.equal(requests[index].method, 'POST')
    succeed(index, null)
    await completion
    succeed(index + 1, { list: [orderVO(nextStatus)] })
    await flush()
  }
  await refresh(seller, 4)
  assert.deepEqual(visibleActions(buyer), [])
  assert.deepEqual(visibleActions(seller), [])
  assert.equal(buyer.data.orders[0].status, '已完成')
  assert.equal(seller.data.orders[0].status, '已完成')
})
}

const paymentParams = { timeStamp: '123', nonceStr: 'nonce', package: 'prepay_id=test', paySign: 'signature' }
for (const [label, status, side, handler, endpoint, nextStatus] of [
  ['发布者付款', 0, 'buy', 'onPayOrder', 'pay', 1],
  ['接单者缴押金', 1, 'sell', 'onPayDeposit', 'deposit-pay', 2]
]) {
  for (const failure of ['下单拒绝', '参数缺失', '用户取消', '查单失败']) {
    test(`${label}${failure}时保留原状态，解除锁定后可以重试`, async () => {
      const page = createPage(status, side)
      const event = actionEvent(page, handler)
      const payment = page[handler](event)
      await page[handler](event)
      assert.equal(requests.length, 1)
      if (failure === '下单拒绝') {
        requests[0].success({ data: { code: 2606, message: '支付已超时' } })
      } else if (failure === '参数缺失') {
        succeed(0, { paymentNo: 'PAY-failed', payParams: {} })
      } else {
        succeed(0, { paymentNo: 'PAY-failed', payParams: paymentParams })
        await flush()
        if (failure === '用户取消') payments[0].fail({ errMsg: 'requestPayment:fail cancel' })
        else {
          payments[0].success({})
          await flush()
          assert.equal(toasts.length, 0, '微信回调成功后必须等待服务端查单结果')
          succeed(1, { transStat: 'F' })
        }
      }
      await payment
      assert.equal(page.data.orders[0].status, descriptions[status + 1])
      assert.equal(page.data.payingOrderKey, '')
      assert.equal(loading, false)
      assert.equal(toasts.length, 1)
      assert.equal(toasts[0].icon, 'none')
      assert.ok(visibleActions(page).includes(handler))
      await pay(page, handler, endpoint, nextStatus)
      assert.equal(page.data.orders[0].status, descriptions[nextStatus + 1])
    })
  }

  test(`${label}等待业务回调处理完成后才报成功`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const page = createPage(status, side)
    const payment = page[handler](actionEvent(page, handler))
    succeed(0, { paymentNo: 'PAY-pending', payParams: paymentParams })
    await flush()
    payments[0].success({})
    await flush()
    succeed(1, { transStat: 'S', notifyStatus: 1 })
    await flush()
    assert.equal(toasts.length, 0)
    assert.equal(page.data.orders[0].status, descriptions[status + 1])
    t.mock.timers.tick(1000)
    await flush()
    assert.equal(requestPath(2), '/api/v1/payment/query/PAY-pending')
    succeed(2, { transStat: 'S', notifyStatus: 2 })
    await flush()
    succeed(3, { list: [orderVO(nextStatus)] })
    await payment
    assert.equal(toasts.at(-1).icon, 'success')
    assert.equal(page.data.orders[0].status, descriptions[nextStatus + 1])
  })
}

for (const [label, status, side] of [['标记完成', 2, 'sell'], ['确认完成', 3, 'buy']]) {
  test(`${label}接口失败时不改变状态、不提示操作成功`, async () => {
    const page = createPage(status, side)
    page.onConfirmReceipt(actionEvent(page, 'onConfirmReceipt'))
    const confirmation = modals[0].success({ confirm: true })
    requests[0].success({ data: { code: 500, message: '服务暂不可用，请稍后重试' } })
    await confirmation
    assert.equal(page.data.orders[0].status, descriptions[status + 1])
    assert.deepEqual(toasts, [{ title: '服务暂不可用，请稍后重试', icon: 'none' }])
    assert.equal(requests.length, 1)
  })
}

test('发布者取消订单后双方刷新均显示已取消，且无付款或完成入口', async () => {
  const buyer = createPage(0, 'buy')
  buyer.onCancelOrder(actionEvent(buyer, 'onCancelOrder'))
  const cancellation = modals[0].success({ confirm: true })
  assert.equal(requestPath(0), `/api/v1/proxy-class-order/${orderId}/cancel`)
  assert.equal(requests[0].method, 'POST')
  succeed(0, null)
  await cancellation
  succeed(1, { list: [orderVO(5)] })
  await flush()
  const seller = createPage(0, 'sell')
  await refresh(seller, 5)
  assert.deepEqual(visibleActions(buyer), [])
  assert.deepEqual(visibleActions(seller), [])
  assert.equal(buyer.data.orders[0].status, '已取消')
  assert.equal(seller.data.orders[0].status, '已取消')
})
