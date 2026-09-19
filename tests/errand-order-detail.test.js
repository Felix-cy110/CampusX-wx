const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

let definition
let requests
let navigations
let modals
let toasts
let storage
const app = { globalData: {} }
global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/order/order' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => storage.get(key),
  removeStorageSync: key => storage.delete(key),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
  getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32, left: 290 }),
  request: options => requests.push(options),
  navigateTo(options) { navigations.push(options.url); if (options.success) options.success({}) },
  showModal: options => modals.push(options),
  showToast: options => toasts.push(options),
  showLoading() {}, hideLoading() {}, hideShareMenu() {}
}
require('../pages/order/order')
const orderDefinition = definition
require('../pages/errand-detail/errand-detail')
const detailDefinition = definition
const orderTemplate = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')
const detailTemplate = fs.readFileSync(path.join(__dirname, '../pages/errand-detail/errand-detail.wxml'), 'utf8')
const orderId = '9007199254740993'

test.beforeEach(() => {
  requests = []; navigations = []; modals = []; toasts = []
  storage = new Map([['token', 'test-token']])
  app.globalData = { isJoinedSchool: true, isLoggedIn: true, userInfo: { uid: '7' } }
})

function createPage(pageDefinition) {
  return { ...pageDefinition, data: structuredClone(pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) } }
}

function cardEvent(order) {
  const card = orderTemplate.match(/<view\b[^>]*bindtap="onOrderTap"[^>]*>/)[0]
  const dataset = {}
  for (const binding of card.matchAll(/data-([\w-]+)="\{\{item\.(\w+)\}\}"/g)) {
    dataset[binding[1]] = order[binding[2]]
  }
  return { currentTarget: { dataset } }
}

function bottomBarVisible(page) {
  const condition = detailTemplate.match(/class="bottom-bar" wx:if="\{\{(.*?)\}\}"/)[1]
  return Boolean(vm.runInNewContext(condition, page.data))
}

function succeed(index, data) {
  requests[index].success({ data: { code: 200, data } })
}

for (const side of ['buy', 'sell']) {
  for (const [status, statusDesc] of [[-1, '待需求方确认'], [0, '待买方付款'], [4, '已完成'], [5, '已取消']]) {
    test(`${side}/${statusDesc}订单卡片使用订单ID加载跑腿历史，不再查询普通帖子`, async () => {
      app.globalData.userInfo.uid = side === 'buy' ? '8' : '7'
      const orders = createPage(orderDefinition)
      const order = orders.mapProxyOrder({ orderId, demandId: 17, status }, side)
      orders.onOrderTap(cardEvent(order))
      const url = new URL(navigations[0], 'https://mini-program.test')
      assert.equal(url.pathname, '/pages/errand-detail/errand-detail')
      assert.equal(url.searchParams.get('orderId'), orderId)
      const detail = createPage(detailDefinition)
      // 即使缓存了同ID的公开需求，订单入口仍必须查鉴权后的订单接口。
      storage.set('currentErrand', { id: 17, title: '过期缓存', type: 'errand' })
      const loaded = detail.onLoad(Object.fromEntries(url.searchParams))
      assert.equal(new URL(requests[0].url).pathname, '/api/v1/proxy-class-order/detail')
      assert.deepEqual(requests[0].data, { orderId })
      assert.equal(requests[0].header.Authorization, 'Bearer test-token')
      succeed(0, {
        orderId, orderNo: 'PC-test', demandId: 17, courseName: '历史跑腿', fee: 12,
        classTime: [2025, 9, 19, 17, 9], locationBuilding: '教学楼',
        buyerId: 8, buyerNickname: '发布者', buyerAvatarUrl: '/images/buyer.png',
        sellerId: 7, sellerNickname: '接单人', sellerAvatarUrl: '/images/seller.png', status, statusDesc
      })
      await loaded
      assert.equal(detail.data.demand.id, 17)
      assert.equal(detail.data.demand.title, '历史跑腿')
      assert.equal(detail.data.demand.user.uid, side === 'buy' ? '7' : '8')
      assert.equal(detail.data.demand.user.avatar,
        'https://xixutech.cn/images/' + (side === 'buy' ? 'seller' : 'buyer') + '.png')
      assert.match(detail.data.demand.content, /教学楼.*\n2025-09-19 17:09/)
      assert.equal(detail.data.order.statusDesc, statusDesc)
      assert.equal(detail.data.loading, false)
      assert.equal(bottomBarVisible(detail), false)
      await detail.applyOrder()
      assert.equal(modals.length, 0)
      assert.equal(requests.length, 1)
      assert.equal(new URL(detail.onShareAppMessage().path, 'https://mini-program.test').searchParams.has('orderId'), false)
    })
  }
}

test('即使没有需求ID也可按订单ID查看历史，缺少订单ID时禁止错误跳转', () => {
  const page = createPage(orderDefinition)
  page.onOrderTap(cardEvent(page.mapProxyOrder({ orderId }, 'buy')))
  assert.equal(navigations[0], '/pages/errand-detail/errand-detail?orderId=' + orderId)
  page.onOrderTap(cardEvent(page.mapProxyOrder({ demandId: 17 }, 'buy')))
  assert.equal(navigations.length, 1)
  assert.equal(toasts[0].title, '订单信息不可用')
})

for (const failure of ['无权查看', '订单不存在', '网络超时']) {
  test(`订单详情${failure}时展示原因，不读取缓存或降级为公开下单页面`, async () => {
    const page = createPage(detailDefinition)
    storage.set('currentErrand', { id: 17, title: '缓存跑腿', type: 'errand' })
    const loaded = page.onLoad({ id: '17', orderId })
    if (failure === '网络超时') requests[0].fail({ errMsg: 'request:fail timeout' })
    else requests[0].success({ data: { code: failure === '无权查看' ? 403 : 2606, message: failure } })
    await loaded
    assert.equal(page.data.orderId, orderId)
    assert.equal(page.data.demand, null)
    assert.equal(page.data.order, null)
    assert.equal(page.data.loading, false)
    assert.match(page.data.loadError, failure === '网络超时' ? /超时/ : new RegExp(failure))
    assert.equal(bottomBarVisible(page), false)
    await page.applyOrder()
    assert.equal(requests.length, 1)
    assert.equal(modals.length, 0)
  })
}

test('普通跑腿需求入口仍读取需求详情，并保留下单按钮', async () => {
  const page = createPage(detailDefinition)
  page.onLoad({ id: '17' })
  assert.equal(new URL(requests[0].url).pathname, '/api/v1/proxy-class-demand/17')
  succeed(0, { id: 17, userId: 8, courseName: '新的跑腿', fee: 10, status: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.orderId, '')
  assert.equal(bottomBarVisible(page), true)
})
