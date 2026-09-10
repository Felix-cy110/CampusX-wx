const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

let definition
let requests = []
let navigations = []
const app = { globalData: { isLoggedIn: true, isJoinedSchool: true, userInfo: { uid: '7', campusId: 100 } } }
global.getApp = () => app
global.getCurrentPages = () => [{}]
global.Page = page => { definition = page }
global.wx = {
  getStorageSync(key) { return key === 'token' ? 'test-token' : undefined },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  getSystemInfoSync() { return { statusBarHeight: 24 } },
  getMenuButtonBoundingClientRect() { return { top: 28, height: 32 } },
  request(options) { requests.push(options) },
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  redirectTo(options) { navigations.push(options) },
  showToast() {},
  showLoading() {},
  hideLoading() {}
}
require('../pages/book-preorder-detail/book-preorder-detail')
const detailDefinition = definition
require('../pages/book-preorder/book-preorder')
const listDefinition = definition

function createPage(pageDefinition = detailDefinition) {
  requests = []
  navigations = []
  return Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) }
  })
}

function succeed(index, data) {
  requests[index].success({ data: { code: 200, data } })
}

function reject(index, message) {
  requests[index].success({ data: { code: 422, message } })
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

const presale = { id: 8, bookName: '高等数学', price: '50.00', depositAmount: '20.00', finalAmount: '30.00', stock: 50, orderedCount: 2, status: 1, coverImage: '/images/presale.jpg' }
const order = { id: 21, presaleId: 8, orderNo: 'BP21', quantity: 2, unitPrice: '50.00', totalAmount: '100.00', depositAmount: '40.00', finalAmount: '60.00', status: 1 }

test('预购详情正常加载商品、价格和订单，图片使用公网路径', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8' })
  assert.equal(page.data.loading, true)
  assert.equal(requests[0].url, 'https://xixutech.cn/api/v1/presale/8')
  succeed(0, presale)
  succeed(1, { list: [order], nextCursor: null })
  await loaded
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.presale.bookName, '高等数学')
  assert.equal(page.data.presale.coverImage, 'https://xixutech.cn/images/presale.jpg')
  assert.equal(page.data.totalPrice, '50.00')
  assert.equal(page.data.myOrder.id, 21)
})

test('缺少或非法商品、订单 ID 时不发送 NaN 请求，并提供明确错误状态', () => {
  for (const options of [{}, { id: 'NaN' }, { id: '8bad' }, { id: '0' }, { id: '-1' }, { id: '8', orderId: 'undefined' }]) {
    const page = createPage()
    page.onLoad(options)
    assert.equal(requests.length, 0)
    assert.equal(page.data.presale, null)
    assert.match(page.data.loadError, /链接无效/)
  }
})

test('商品不存在时显示真实错误，隐藏空商品并禁止下单', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8' })
  reject(0, '预售活动不存在')
  succeed(1, { list: [], nextCursor: null })
  await loaded
  assert.equal(page.data.loadError, '预售活动不存在')
  assert.equal(page.data.presale, null)
  assert.equal(page.data.loading, false)
  page.onSubmitOrder()
  assert.equal(requests.length, 2)
})

test('网络失败后可重试恢复，连续重试不会重复请求', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8' })
  requests[0].fail({ errMsg: 'request:fail timeout' })
  succeed(1, { list: [], nextCursor: null })
  await loaded
  assert.match(page.data.loadError, /超时/)
  const retried = page.retryLoad()
  page.retryLoad()
  assert.equal(requests.length, 4)
  succeed(2, presale)
  succeed(3, { list: [], nextCursor: null })
  await retried
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.presale.id, 8)
})

test('空数据和不完整商品不会显示空详情', async () => {
  for (const response of [null, {}, { id: 8 }, { ...presale, price: 'not-a-number' }, { ...presale, id: 9 }]) {
    const page = createPage()
    const loaded = page.onLoad({ id: '8' })
    succeed(0, response)
    succeed(1, { list: [], nextCursor: null })
    await loaded
    assert.equal(page.data.presale, null)
    assert.match(page.data.loadError, /信息不完整/)
  }
})

test('已结束活动仍能展示商品和已完成订单', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8', orderId: '21' })
  succeed(0, { ...presale, status: 2 })
  succeed(1, { list: [{ ...order, status: 2 }], nextCursor: null })
  await loaded
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.presale.status, 2)
  assert.equal(page.data.myOrder.status, 2)
  assert.equal(page.data.orderView, true)
})

test('详情按游标查找历史订单，选中已取消订单时保留该订单', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8', orderId: '21' })
  succeed(0, presale)
  succeed(1, { list: [{ ...order, id: 30 }], nextCursor: 30 })
  await flush()
  assert.equal(requests[2].data.cursor, 30)
  succeed(2, { list: [{ ...order, status: 3 }], nextCursor: null })
  await loaded
  assert.equal(page.data.myOrder.id, 21)
  assert.equal(page.data.myOrder.status, 3)
  assert.equal(page.data.orderError, '')
  page.onSubmitOrder()
  assert.equal(requests.length, 3)
})

test('市场详情也能找到第一页以后的本人有效订单', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8' })
  succeed(0, presale)
  succeed(1, { list: [{ ...order, presaleId: 99 }], nextCursor: 30 })
  await flush()
  succeed(2, { list: [order], nextCursor: null })
  await loaded
  assert.equal(page.data.myOrder.id, 21)
})

test('订单查询失败时保留已加载商品，禁止误下单，订单可单独重试', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8' })
  succeed(0, presale)
  reject(1, '获取订单失败')
  await loaded
  assert.equal(page.data.presale.id, 8)
  assert.equal(page.data.orderError, '获取订单失败')
  page.onSubmitOrder()
  assert.equal(requests.length, 2)
  const retry = page.retryOrder()
  succeed(2, { list: [order], nextCursor: null })
  await retry
  assert.equal(page.data.orderError, '')
  assert.equal(page.data.myOrder.id, 21)
})

test('指定订单查不到或对应另一商品时显示订单错误且不展示购买入口', async () => {
  const page = createPage()
  const loaded = page.onLoad({ id: '8', orderId: '21' })
  succeed(0, presale)
  succeed(1, { list: [{ ...order, presaleId: 99 }], nextCursor: null })
  await loaded
  assert.equal(page.data.myOrder, null)
  assert.match(page.data.orderError, /不存在或无法查看/)
  page.onSubmitOrder()
  assert.equal(requests.length, 2)
})

test('历史我的订单入口跳到订单列表，不再请求未定义的商品', () => {
  const page = createPage()
  page.onLoad({ myOrders: '1' })
  assert.equal(requests.length, 0)
  assert.equal(navigations[0].url, '/pages/book-preorder/book-preorder?tab=orders')
})

test('我的订单入口正确请求订单列表，并携带活动与订单 ID 进入详情', async () => {
  const page = createPage(listDefinition)
  const loaded = page.onTapMyOrders()
  assert.equal(page.data.activeTab, 'orders')
  assert.equal(requests[0].url, 'https://xixutech.cn/api/v1/presale/orders/my')
  assert.equal(requests[0].data.status, undefined)
  succeed(0, { list: [order], nextCursor: null })
  await loaded
  assert.equal(page.data.filteredList[0].statusLabel, '待付尾款')
  page.onTapItem({ currentTarget: { dataset: { id: 8, orderId: 21 } } })
  assert.equal(navigations[0].url, '/pages/book-preorder-detail/book-preorder-detail?id=8&orderId=21')
})

test('订单列表能加载后续页，分页网络失败可重试且保留已有订单', async () => {
  const page = createPage(listDefinition)
  const loaded = page.onLoad({ tab: 'orders' })
  succeed(0, { list: [{ ...order, id: 30 }], nextCursor: 30 })
  await loaded
  const more = page.loadMore()
  assert.equal(requests[1].data.cursor, 30)
  reject(1, '网络繁忙')
  await more
  assert.equal(page.data.filteredList.length, 1)
  assert.equal(page.data.loadError, '网络繁忙')
  const retry = page.retryLoad()
  succeed(2, { list: [order], nextCursor: null })
  await retry
  assert.deepEqual(page.data.filteredList.map(item => item.id), [30, 21])
  assert.equal(page.data.loadError, '')
})

test('详情模板仅在商品加载成功后展示内容，订单未知时隐藏下单栏', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/book-preorder-detail/book-preorder-detail.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{loading\}\}"/)
  assert.match(wxml, /wx:elif="\{\{loadError\}\}"/)
  assert.match(wxml, /<scroll-view wx:elif="\{\{presale\}\}"/)
  assert.match(wxml, /!orderLoading && !orderError && !orderView && !myOrder/)
})
