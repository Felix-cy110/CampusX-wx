const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

let definition
let requests = []
let pending = []
let navigations = []
let modals = []
let storage = new Map()
const app = { globalData: {} }
global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/order/order' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 } },
  getMenuButtonBoundingClientRect() { return { top: 28, height: 32, left: 290 } },
  request(options) {
    requests.push(options)
    if (options.url.includes('/favorite/list')) {
      options.success({ data: { code: 200, data: { list: [] } } })
    } else if (options.url.includes('/follow/count/')) {
      options.success({ data: { code: 200, data: { followedByMe: false } } })
    } else {
      pending.push(options)
    }
  },
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  showModal(options) { modals.push(options) },
  showToast() {}, showLoading() {}, hideLoading() {}
}
require('../pages/market-detail/market-detail')
const marketDefinition = definition
require('../pages/order/order')
const orderDefinition = definition
const { resetAuthNavigation } = require('../utils/auth')
const { resetFollowState } = require('../utils/follow')
const orderTemplate = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')

test.beforeEach(() => {
  requests = []
  pending = []
  navigations = []
  modals = []
  storage = new Map([['token', 'test-token']])
  app.globalData = { isLoggedIn: true, isJoinedSchool: true, userInfo: { uid: '7', campusId: 100 } }
  resetAuthNavigation()
  resetFollowState()
})

const rental = {
  productId: 812, sellerId: 18, sellerNickname: '相机出租人',
  title: '租赁相机', description: '可短期租用', imageUrls: ['/images/camera.jpg'],
  rentPrice: '35.50', deposit: '500.00', rentUnit: 'day', deliveryType: 2,
  availableStart: [2026, 9, 1], availableEnd: '2026-10-01'
}

function createPage(pageDefinition = marketDefinition) {
  return Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) }
  })
}

function succeed(index, data) { pending[index].success({ data: { code: 200, data } }) }
async function flush() { await new Promise(resolve => setImmediate(resolve)) }
function requestPath(options) { return new URL(options.url).pathname }
function assertNoIdleRequests() { assert.equal(requests.some(options => options.url.includes('/idle/')), false) }

async function loadRental(options = {}, overrides = {}) {
  const page = createPage()
  const task = page.onLoad({ id: '812', type: 'rental', ...options })
  succeed(pending.length - 1, { ...rental, ...overrides })
  await task
  await flush()
  return page
}

test('公开租赁详情只查询租赁接口，并显示租金、押金、租期和送达方式', async () => {
  const page = await loadRental()
  assert.equal(requestPath(pending[0]), '/api/v1/rental/product/812')
  assert.equal(pending[0].method, 'GET')
  assert.equal(pending[0].data, undefined)
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.item.price, 35.5)
  assert.equal(page.data.item.deposit, 500)
  assert.equal(page.data.item.rentUnitLabel, '天')
  assert.equal(page.data.item.availableStart, '2026-09-01')
  assert.equal(page.data.item.availableEnd, '2026-10-01')
  assert.equal(page.data.item.deliveryType, '送达')
  assert.deepEqual(page.data.item.images, ['https://xixutech.cn/images/camera.jpg'])
  assertNoIdleRequests()
})

test('按次租赁和自取使用正确展示单位', async () => {
  const page = await loadRental({}, { rentUnit: 'piece', deliveryType: 1 })
  assert.equal(page.data.item.rentUnitLabel, '次')
  assert.equal(page.data.item.deliveryType, '自取')
})

test('租赁订单的真实卡片跳转保留商品类型和订单号', async () => {
  const orderPage = createPage(orderDefinition)
  const order = orderPage.mapRentalOrder({ id: '9007199254740993', productId: 812, productTitle: '租赁相机' }, 'buy')
  const card = orderTemplate.match(/<view\b[^>]*bindtap="onOrderTap"[^>]*>/)[0]
  const dataset = {}
  for (const match of card.matchAll(/data-([\w-]+)="\{\{item\.([\w]+)\}\}"/g)) {
    dataset[match[1]] = order[match[2]]
  }
  orderPage.onOrderTap({ currentTarget: { dataset } })
  const target = new URL(navigations[0].url, 'https://mini.example')
  assert.equal(target.searchParams.get('type'), 'rental')
  assert.equal(target.searchParams.get('id'), '812')
  assert.equal(target.searchParams.get('orderId'), '9007199254740993')
  const page = await loadRental(Object.fromEntries(target.searchParams))
  assert.deepEqual(pending[0].data, { orderId: '9007199254740993' })
  assert.equal(page.data.item.title, '租赁相机')
  assertNoIdleRequests()
})

test('租赁业务错误保留真实原因，连类型不匹配错误也不尝试二手接口', async () => {
  for (const [code, message] of [[422, '该商品不是闲置物品'], [403, '无权查看该商品'], [404, '商品不存在']]) {
    const page = createPage()
    const requestCount = pending.length
    const task = page.onLoad({ id: '812', type: 'rental' })
    pending.at(-1).success({ data: { code, message } })
    await task
    assert.equal(pending.length, requestCount + 1)
    assert.equal(page.data.loading, false)
    assert.equal(page.data.loadError, message)
    assert.deepEqual(page.data.item, {})
  }
  assertNoIdleRequests()
})

test('租赁网络失败后重试保留订单号与类型，并阻止重复重试', async () => {
  const page = createPage()
  const initialTask = page.onLoad({ id: '812', type: 'rental', orderId: '73' })
  pending[0].fail({ errMsg: 'request:fail timeout' })
  await initialTask
  assert.equal(page.data.loadError, '连接服务器超时，请切换网络后重试')
  const retryTask = page.retryLoad()
  page.retryLoad()
  assert.equal(pending.length, 2)
  assert.equal(requestPath(pending[1]), '/api/v1/rental/product/812')
  assert.deepEqual(pending[1].data, { orderId: '73' })
  succeed(1, rental)
  await retryTask
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.productType, 'rental')
  assert.equal(page.data.item.id, 812)
  assertNoIdleRequests()
})

test('租赁接口返回空数据时显示错误状态而非空白商品', async () => {
  const page = createPage()
  const task = page.onLoad({ id: '812', type: 'rental' })
  succeed(0, null)
  await task
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '商品信息加载失败，请重试')
  assert.deepEqual(page.data.item, {})
  assert.equal(pending.length, 1)
  assertNoIdleRequests()
})

test('租赁收藏查询和切换使用租赁目标类型', async () => {
  const page = await loadRental()
  const favoriteQuery = requests.find(options => options.url.includes('/favorite/list'))
  assert.equal(favoriteQuery.data.targetType, 1)
  page.toggleFavorite()
  const toggle = pending.at(-1)
  assert.equal(requestPath(toggle), '/api/v1/favorite/toggle')
  assert.deepEqual(toggle.data, { targetId: 812, targetType: 1 })
  succeed(pending.length - 1, null)
  await flush()
  assert.equal(page.data.isFavorited, true)
})

test('租赁举报和分享保留商品类型，公开分享不带订单查看凭据', async () => {
  const page = await loadRental({ orderId: '73' })
  page.doReport()
  assert.equal(navigations.at(-1).url, '/pages/complaint/complaint?targetType=RENTAL_PRODUCT&targetId=812')
  assert.equal(page.onShareAppMessage().path, '/pages/market-detail/market-detail?id=812&type=rental')
})

test('公开和订单租赁详情都不能调用二手购买流程', async () => {
  for (const orderId of ['', '73']) {
    const page = await loadRental({ orderId })
    const requestCount = requests.length
    page.createOrder()
    await page.purchaseItem(page.data.item)
    assert.equal(modals.length, 0)
    assert.equal(requests.length, requestCount)
    assert.equal(page.data.purchasePending, false)
  }
  assertNoIdleRequests()
})

test('租赁订单详情禁止下架，公开卖家详情下架仅调用租赁接口', async () => {
  const orderPage = await loadRental({ orderId: '73' }, { sellerId: 7 })
  const requestCount = requests.length
  orderPage.closeDeal()
  assert.equal(modals.length, 0)
  assert.equal(requests.length, requestCount)

  const publicPage = await loadRental({}, { sellerId: 7 })
  publicPage.closeDeal()
  modals.at(-1).success({ confirm: true })
  const offShelf = pending.at(-1)
  assert.equal(requestPath(offShelf), '/api/v1/rental/product/812/off-shelf')
  assert.equal(offShelf.method, 'PUT')
  succeed(pending.length - 1, null)
  await flush()
  assert.equal(publicPage.data.isOwnerClosing, true)
  assertNoIdleRequests()
})
