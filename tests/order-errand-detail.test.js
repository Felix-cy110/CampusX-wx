const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

let definition
let requests, navigations, toasts, storage, modals, hiddenShares, backCount
const app = { globalData: {} }
global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/order/order' }, { route: 'pages/errand-detail/errand-detail' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => storage.get(key),
  removeStorageSync: key => storage.delete(key),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
  getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32, left: 290 }),
  request: options => requests.push(options),
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  navigateBack() { backCount++ },
  showToast: options => toasts.push(options),
  showModal: options => modals.push(options),
  showLoading() {},
  hideLoading() {},
  hideShareMenu() { hiddenShares++ }
}
require('../pages/order/order')
const listDefinition = definition
require('../pages/errand-detail/errand-detail')
const detailDefinition = definition
const { resetAuthNavigation } = require('../utils/auth')
const orderTemplate = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')
const detailTemplate = fs.readFileSync(path.join(__dirname, '../pages/errand-detail/errand-detail.wxml'), 'utf8')

test.beforeEach(() => {
  requests = []; navigations = []; toasts = []; modals = []
  hiddenShares = 0; backCount = 0
  storage = new Map([['token', 'test-token']])
  app.globalData = { isLoggedIn: true, isJoinedSchool: true, userInfo: { uid: '1077' } }
  resetAuthNavigation()
})

function page(entry = detailDefinition, data = {}) {
  return { ...entry, data: { ...structuredClone(entry.data), ...data },
    setData(updates) { Object.assign(this.data, updates) } }
}

function tapEvent(order) {
  const card = orderTemplate.match(/<view\b[^>]*bindtap="onOrderTap"[^>]*>/)
  assert.ok(card)
  const dataset = {}
  for (const match of card[0].matchAll(/data-([\w-]+)="\{\{item\.([\w]+)\}\}"/g)) {
    dataset[match[1]] = order[match[2]]
  }
  return { currentTarget: { dataset } }
}

function visible(handler, data) {
  const stack = []
  for (const tag of detailTemplate.matchAll(/<(\/?)([\w-]+)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
    if (tag[1]) { stack.pop(); continue }
    const condition = tag[3].match(/wx:if="\{\{([\s\S]*?)\}\}"/)
    const conditions = stack.filter(Boolean)
    if (condition) conditions.push(condition[1])
    if (tag[3].includes('bindtap="' + handler + '"') || tag[3].includes('catchtap="' + handler + '"')) {
      return conditions.every(value => !!vm.runInNewContext(value, structuredClone(data)))
    }
    if (!/\/\s*$/.test(tag[3])) stack.push(condition ? condition[1] : '')
  }
  assert.fail('找不到模板操作：' + handler)
}

const detail = {
  orderId: '9007199254740993', orderNo: 'PC-TEST-59', demandId: 112,
  status: -1, statusDesc: '待需求方确认', courseName: '测试跑腿',
  classTime: [2026, 9, 19, 17, 9], createdAt: '2026-09-19T11:22:26',
  locationCampus: '主校区', locationBuilding: '教学楼', locationRoom: '101', fee: '12.50',
  buyerId: 1077, buyerNickname: '发布者', buyerAvatarUrl: '/images/buyer.png',
  sellerId: 1088, sellerNickname: '接单人', sellerAvatarUrl: '/images/seller.png'
}

function success(data = detail, index = 0) {
  requests[index].success({ data: { code: 200, data } })
}

for (const [side, uid, otherId, otherName] of [
  ['buy', '1077', '1088', '接单人'], ['sell', '1088', '1077', '发布者']
]) {
  test(`${side} 点击跑腿订单按订单 ID 加载真实详情，不请求普通帖子或公开需求`, async () => {
    app.globalData.userInfo.uid = uid
    const list = page(listDefinition, { currentTab: 'errand', currentSide: side })
    const loading = list.loadOrders()
    success({ list: [detail] })
    await loading
    list.onOrderTap(tapEvent(list.data.filteredOrders[0]))
    assert.equal(navigations.length, 1)
    const target = new URL(navigations[0].url, 'https://mini.example')
    assert.equal(target.pathname, '/pages/errand-detail/errand-detail')
    assert.equal(target.searchParams.get('orderId'), detail.orderId)
    const view = page()
    const loaded = view.onLoad(Object.fromEntries(target.searchParams))
    assert.equal(requests[1].url, 'https://xixutech.cn/api/v1/proxy-class-order/detail')
    assert.deepEqual(requests[1].data, { orderId: detail.orderId })
    assert.equal(requests[1].header.Authorization, 'Bearer test-token')
    success(detail, 1)
    await loaded
    assert.equal(requests.length, 2)
    assert.equal(view.data.loading, false)
    assert.equal(view.data.loadError, '')
    assert.equal(view.data.order.orderNo, 'PC-TEST-59')
    assert.equal(view.data.order.statusDesc, '待需求方确认')
    assert.equal(view.data.demand.title, '测试跑腿')
    assert.match(view.data.demand.content, /主校区 教学楼 101\n2026-09-19 17:09/)
    assert.equal(view.data.demand.reward, 12.5)
    assert.equal(view.data.demand.user.uid, otherId)
    assert.equal(view.data.demand.user.name, otherName)
    assert.match(view.data.demand.user.avatar, /^https:\/\/xixutech.cn\/images\//)
    view.contactUser()
    assert.equal(new URL(navigations[1].url, 'https://mini.example').searchParams.get('userId'), otherId)
    assert.equal(visible('applyOrder', view.data), false)
    assert.equal(visible('viewOrders', view.data), true)
    await view.applyOrder()
    assert.equal(modals.length, 0)
    assert.equal(requests.length, 2)
    view.viewOrders()
    assert.equal(backCount, 1)
  })
}

test('缺少需求 ID 的历史订单仍能打开，缺少订单 ID 时明确提示并停止跳转', () => {
  const list = page(listDefinition)
  list.onOrderTap(tapEvent(list.mapProxyOrder({ orderId: 59 }, 'buy')))
  assert.equal(navigations[0].url, '/pages/errand-detail/errand-detail?orderId=59')
  list.onOrderTap(tapEvent(list.mapProxyOrder({ demandId: 112 }, 'buy')))
  assert.equal(navigations.length, 1)
  assert.equal(toasts[0].title, '订单信息不可用')
})

for (const [status, statusDesc] of [[0, '待买方付款'], [2, '进行中'], [4, '已完成'], [5, '已取消']]) {
  test(`过期或已删除需求的${statusDesc}订单仅依赖订单详情接口，并绕过公开缓存`, async () => {
    storage.set('currentErrand', { id: 112, title: '过期缓存', user: { uid: '9' } })
    const view = page()
    const loading = view.onLoad({ id: '112', orderId: '59' })
    assert.equal(requests.length, 1)
    assert.match(requests[0].url, /proxy-class-order\/detail$/)
    success({ ...detail, orderId: 59, status, statusDesc })
    await loading
    assert.equal(view.data.demand.title, '测试跑腿')
    assert.equal(view.data.order.statusDesc, statusDesc)
    assert.equal(visible('applyOrder', view.data), false)
    assert.equal(hiddenShares, 1)
    const share = view.onShareAppMessage()
    assert.equal(share.path, '/pages/errand-detail/errand-detail?id=112&type=demand')
    assert.equal(share.path.includes('orderId'), false)
  })
}

for (const failure of [{ code: 403, message: '无权访问' }, { code: 2701, message: '订单不存在' }]) {
  test(`订单接口返回${failure.message}时保留原因，不回退查询帖子，也不开放下单`, async () => {
    const view = page()
    const loading = view.onLoad({ id: '112', orderId: '59' })
    requests[0].success({ data: failure })
    await loading
    assert.equal(view.data.loadError, failure.message)
    assert.equal(view.data.loading, false)
    assert.equal(view.data.demand, null)
    assert.equal(requests.length, 1)
    assert.equal(visible('applyOrder', view.data), false)
  })
}

test('订单网络失败后可重试，重复点击不重复请求，仍保留原始订单 ID', async () => {
  const view = page()
  const loading = view.onLoad({ orderId: detail.orderId })
  requests[0].fail({ errMsg: 'request:fail timeout' })
  await loading
  assert.match(view.data.loadError, /超时/)
  assert.equal(visible('retryLoad', view.data), true)
  const retry = view.retryLoad()
  view.retryLoad()
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1].data, { orderId: detail.orderId })
  success(detail, 1)
  await retry
  assert.equal(view.data.loadError, '')
  assert.equal(view.data.demand.title, '测试跑腿')
})

test('普通跑腿详情保留公开需求入口及接单按钮', async () => {
  const view = page()
  const loading = view.onLoad({ id: '112' })
  assert.equal(requests[0].url, 'https://xixutech.cn/api/v1/proxy-class-demand/112')
  success({ id: 112, userId: 1088, courseName: '普通跑腿', fee: 10 })
  await loading
  assert.equal(view.data.orderId, '')
  assert.equal(view.data.demand.title, '普通跑腿')
  assert.equal(visible('applyOrder', view.data), true)
  assert.equal(visible('viewOrders', view.data), false)
})
