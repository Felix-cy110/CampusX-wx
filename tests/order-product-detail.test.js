const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

let pageDefinition
let pendingRequests = []
let navigations = []
let modals = []
let toasts = []
let storage = new Map()
const app = { globalData: {} }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/order/order' }]
global.Page = definition => { pageDefinition = definition }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } } },
  getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 } },
  getMenuButtonBoundingClientRect() { return { top: 28, height: 32, left: 290 } },
  request(options) {
    if (options.url.includes('/favorite/list')) {
      options.success({ data: { code: 200, data: { list: [] } } })
    } else if (options.url.includes('/follow/count/')) {
      options.success({ data: { code: 200, data: { followedByMe: false } } })
    } else {
      pendingRequests.push(options)
    }
  },
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  reLaunch(options) { navigations.push(options); if (options.complete) options.complete({}) },
  showModal(options) { modals.push(options) },
  showToast(options) { toasts.push(options) },
  showLoading() {},
  hideLoading() {}
}

require('../pages/order/order')
const orderDefinition = pageDefinition
require('../pages/market-detail/market-detail')
const marketDefinition = pageDefinition
const { resetAuthNavigation } = require('../utils/auth')
const { resetFollowState } = require('../utils/follow')
const orderTemplate = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')
const marketTemplate = fs.readFileSync(path.join(__dirname, '../pages/market-detail/market-detail.wxml'), 'utf8')

test.beforeEach(() => {
  pendingRequests = []
  navigations = []
  modals = []
  toasts = []
  storage = new Map([['token', 'test-token']])
  app.globalData = {
    isLoggedIn: true,
    isJoinedSchool: true,
    userInfo: { uid: '7', campusId: 100 }
  }
  resetAuthNavigation()
  resetFollowState()
})

function createPage(definition = marketDefinition, data = {}) {
  return Object.assign({}, definition, {
    data: Object.assign({}, structuredClone(definition.data), data),
    setData(updates) { Object.assign(this.data, updates) }
  })
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

function reject(index, code, message) {
  pendingRequests[index].success({ data: { code, message } })
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

function requestPaths() {
  return pendingRequests.map(options => new URL(options.url).pathname)
}

// Read the actual card bindings so missing data-id/data-type attributes break navigation tests.
function orderTapEvent(order) {
  const card = orderTemplate.match(/<view\b[^>]*bindtap="onOrderTap"[^>]*>/)
  assert.ok(card, '订单卡片必须绑定 onOrderTap')
  const dataset = {}
  for (const match of card[0].matchAll(/data-([\w-]+)="\{\{item\.([\w]+)\}\}"/g)) {
    dataset[match[1]] = order[match[2]]
  }
  return { currentTarget: { dataset } }
}

// Evaluate wx:if on an action and its ancestors; this checks visibility without a WeChat runtime.
function actionVisible(handler, data) {
  const stack = []
  const tags = /<(\/?)([\w-]+)((?:"[^"]*"|'[^']*'|[^'">])*)>/g
  for (const tag of marketTemplate.matchAll(tags)) {
    if (tag[1]) {
      stack.pop()
      continue
    }
    const attributes = tag[3]
    const condition = attributes.match(/wx:if="\{\{([\s\S]*?)\}\}"/)
    const conditions = stack.flatMap(frame => frame ? [frame] : [])
    if (condition) conditions.push(condition[1])
    if (attributes.includes('bindtap="' + handler + '"')) {
      return conditions.every(expression => Boolean(vm.runInNewContext(expression, structuredClone(data))))
    }
    if (!/\/\s*$/.test(attributes)) stack.push(condition ? condition[1] : '')
  }
  assert.fail('未找到操作节点：' + handler)
}

const product = {
  productId: 812,
  sellerId: 18,
  sellerNickname: '测试卖家',
  sellerAvatar: '/images/seller.png',
  title: '高等数学',
  description: '课本保存完好',
  price: '25.50',
  conditionLevel: 2,
  deliveryType: 1,
  imageUrls: ['/images/product.jpg'],
  author: '测试作者'
}

test('已完成二手订单从列表卡片进入详情时携带订单 ID，买家可查看完整商品', async () => {
  const orders = createPage(orderDefinition, { currentTab: 'secondhand', currentSide: 'buy' })
  const loadingOrders = orders.loadOrders()
  assert.equal(requestPaths()[0], '/api/v1/idle/order/buyer-list')
  succeed(0, { list: [{
    id: '9007199254740993', productId: 812, productTitle: '高等数学', status: 3,
    statusDesc: '已完成', actualPaid: 25.5
  }] })
  await loadingOrders

  orders.onOrderTap(orderTapEvent(orders.data.filteredOrders[0]))
  assert.equal(navigations.length, 1)
  const target = new URL(navigations[0].url, 'https://mini.example')
  assert.equal(target.pathname, '/pages/market-detail/market-detail')
  assert.equal(target.searchParams.get('id'), '812')
  assert.equal(target.searchParams.get('orderId'), '9007199254740993')

  const page = createPage()
  const loadingDetail = page.onLoad(Object.fromEntries(target.searchParams))
  assert.equal(requestPaths()[1], '/api/v1/idle/product/book/812')
  assert.deepEqual(pendingRequests[1].data, { orderId: '9007199254740993' })
  assert.equal(pendingRequests[1].header.Authorization, 'Bearer test-token')
  succeed(1, product)
  await loadingDetail

  assert.equal(page.data.orderId, '9007199254740993')
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.item.id, 812)
  assert.equal(page.data.item.title, '高等数学')
  assert.equal(page.data.item.price, 25.5)
  assert.equal(page.data.item.user.name, '测试卖家')
  assert.deepEqual(page.data.item.images, ['https://xixutech.cn/images/product.jpg'])
  assert.equal(actionVisible('contactSeller', page.data), true)
  page.contactSeller()
  assert.equal(new URL(navigations[1].url, 'https://mini.example').searchParams.get('userId'), '18')
})

test('二手订单缺少订单 ID 时不会降级为普通购买入口', () => {
  const page = createPage(orderDefinition)
  const order = page.mapIdleOrder({ productId: 812, status: 3 }, 'buy')
  page.onOrderTap(orderTapEvent(order))
  assert.equal(navigations.length, 0)
  assert.equal(pendingRequests.length, 0)
})

test('租赁订单保留租赁类型及订单号，代课订单不附商品订单参数', () => {
  const page = createPage(orderDefinition)
  page.onOrderTap(orderTapEvent(page.mapRentalOrder({ id: 71, productId: 812 }, 'buy')))
  page.onOrderTap(orderTapEvent(page.mapProxyOrder({ orderId: 72, demandId: 913 }, 'buy')))
  assert.deepEqual(navigations.map(options => options.url), [
    '/pages/market-detail/market-detail?id=812&type=rental&orderId=71',
    '/pages/post-detail/post-detail?id=913'
  ])
})

test('已知闲置类型的订单详情直接请求闲置接口，并把数字订单 ID 保存为字符串', async () => {
  const page = createPage()
  const loading = page.onLoad({ id: '812', type: 'item', orderId: 61 })
  assert.equal(page.data.orderId, '61')
  assert.deepEqual(requestPaths(), ['/api/v1/idle/product/item/812'])
  assert.deepEqual(pendingRequests[0].data, { orderId: '61' })
  succeed(0, { ...product, title: '台灯' })
  await loading
  assert.equal(page.data.item.title, '台灯')
  assert.equal(page.data.loadError, '')
})

for (const [type, nextType, message] of [
  ['book', 'item', '该商品不是二手书'],
  ['item', 'book', '该商品不是闲置物品']
]) {
  test(`订单商品 ${type} 类型回退到 ${nextType} 时保留订单 ID`, async () => {
    const page = createPage()
    const loading = page.onLoad({ id: '812', type, orderId: '61' })
    reject(0, 422, message)
    await flush()
    assert.deepEqual(requestPaths(), [
      `/api/v1/idle/product/${type}/812`, `/api/v1/idle/product/${nextType}/812`
    ])
    assert.deepEqual(pendingRequests.map(options => options.data), [{ orderId: '61' }, { orderId: '61' }])
    succeed(1, product)
    await loading
    assert.equal(page.data.productType, nextType)
    assert.equal(page.data.item.id, 812)
    assert.equal(page.data.loadError, '')
  })
}

test('订单详情类型回退后网络失败，再次加载仍携带订单 ID', async () => {
  const page = createPage()
  const loading = page.onLoad({ id: '812', orderId: '61' })
  reject(0, 422, '该商品不是二手书')
  await flush()
  pendingRequests[1].fail({ errMsg: 'request:fail timeout' })
  await loading
  assert.match(page.data.loadError, /超时/)
  assert.equal(page.data.loading, false)

  const retry = page.retryLoad()
  page.retryLoad()
  assert.deepEqual(requestPaths(), [
    '/api/v1/idle/product/book/812', '/api/v1/idle/product/item/812', '/api/v1/idle/product/item/812'
  ])
  assert.deepEqual(pendingRequests[2].data, { orderId: '61' })
  succeed(2, { ...product, title: '台灯' })
  await retry
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.item.title, '台灯')
})

test('订单详情权限校验失败时保留错误，不丢弃订单 ID 再尝试普通入口', async () => {
  const page = createPage()
  const loading = page.onLoad({ id: '812', orderId: '61' })
  reject(0, 403, '无权查看该订单商品')
  await loading
  assert.equal(pendingRequests.length, 1)
  assert.equal(page.data.orderId, '61')
  assert.equal(page.data.loadError, '无权查看该订单商品')
  assert.deepEqual(page.data.item, {})
  assert.equal(actionVisible('createOrder', page.data), false)
})

for (const isOwn of [false, true]) {
  test(`订单商品只读视图禁止重复购买与下架（${isOwn ? '卖家' : '买家'}）`, async () => {
    const page = createPage(marketDefinition, {
      orderId: '61', itemId: '812', loading: false,
      item: { id: 812, title: '高等数学', isOwn, user: { uid: '18' } }
    })
    assert.equal(actionVisible('createOrder', page.data), false)
    assert.equal(actionVisible('closeDeal', page.data), false)
    page.createOrder()
    await page.purchaseItem(page.data.item)
    page.closeDeal()
    assert.equal(modals.length, 0)
    assert.equal(pendingRequests.length, 0)
    assert.equal(page.data.purchasePending, false)
    assert.equal(page.data.isOwnerClosing, false)
  })
}

test('普通商品入口不附订单 ID，仍可确认购买并创建新订单', async () => {
  const page = createPage()
  const loading = page.onLoad({ id: '812', type: 'book' })
  assert.equal(page.data.orderId, '')
  assert.equal(Object.hasOwn(pendingRequests[0].data || {}, 'orderId'), false)
  succeed(0, product)
  await loading
  assert.equal(actionVisible('createOrder', page.data), true)

  page.createOrder()
  assert.equal(modals.length, 1)
  modals[0].success({ confirm: true })
  assert.equal(requestPaths()[1], '/api/v1/idle/order')
  assert.equal(pendingRequests[1].method, 'POST')
  assert.deepEqual(pendingRequests[1].data, { productId: 812 })
  reject(1, 2902, '商品已售出')
  await flush()
  assert.equal(page.data.purchasePending, false)
})

test('从订单详情分享时只分享公开商品链接，不携带订单 ID', async () => {
  const page = createPage()
  const loading = page.onLoad({ id: '812', type: 'item', orderId: '61' })
  succeed(0, { ...product, title: '台灯' })
  await loading
  const share = page.onShareAppMessage()
  assert.equal(share.path, '/pages/market-detail/market-detail?id=812&type=item')
  assert.equal(share.title, '台灯')
  assert.equal(share.imageUrl, 'https://xixutech.cn/images/product.jpg')
  assert.equal(new URL(share.path, 'https://mini.example').searchParams.has('orderId'), false)
})
