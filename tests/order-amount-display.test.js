const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

let pageDefinition
let pendingRequests = []

global.Page = definition => { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } } },
  request(options) { pendingRequests.push(options) }
}

require('../pages/order/order')
const template = fs.readFileSync(path.join(__dirname, '../pages/order/order.wxml'), 'utf8')

test.beforeEach(() => { pendingRequests = [] })

function createPage(currentTab = 'all', currentSide = 'buy') {
  return Object.assign({}, pageDefinition, {
    data: Object.assign({}, structuredClone(pageDefinition.data), { currentTab, currentSide }),
    setData(updates) { Object.assign(this.data, structuredClone(updates)) }
  })
}

// 检查真实模板的金额节点与 Page 数据绑定，不模拟微信渲染引擎。
function priceText(order) {
  return ['price-label', 'price-symbol', 'price-value'].map(className => {
    const node = template.match(new RegExp('<text class="' + className + '">([^<]*)</text>'))
    assert.ok(node, '缺少金额节点：' + className)
    if (!node[1].includes('{{')) return node[1]
    const binding = node[1].match(/^\{\{item\.(\w+)\}\}$/)
    assert.ok(binding, '金额必须绑定可直接显示的数据，不能在 WXML 中调用方法')
    const value = order[binding[1]]
    assert.notEqual(value, undefined, '金额节点绑定的字段必须存在')
    return String(value)
  }).join('')
}

function succeed(request, list) {
  request.success({ data: { code: 200, data: { list } } })
}

const fixtures = {
  secondhand: [
    { id: 11, productTitle: '司机说', actualPaid: '18.00', status: 4, statusDesc: '已取消' },
    { id: 12, productTitle: 'qq', actualPaid: 25.5, price: 30, status: 3, statusDesc: '已完成' },
    { id: 13, actualPaid: 0, price: 0, status: 3, statusDesc: '已完成' },
    { id: 14, actualPaid: null, price: '8.50', status: 0, statusDesc: '待付款' },
    { id: 15, actualPaid: '0.01', status: 3, statusDesc: '已完成' },
    { id: 16, actualPaid: '123456.78', status: 3, statusDesc: '已完成' }
  ],
  rental: [
    { id: 21, actualPaid: '120.50', status: 4, statusDesc: '已完成' },
    { id: 22, actualPaid: 10, status: 5, statusDesc: '已取消' },
    { id: 23, actualPaid: 0, status: 4, statusDesc: '已完成' }
  ],
  errand: [
    { orderId: 31, fee: '8.5', status: 6, statusDesc: '已完成' },
    { orderId: 32, fee: 15, status: 7, statusDesc: '已取消' },
    { orderId: 33, fee: 0, status: 6, statusDesc: '已完成' }
  ]
}

const expectedPrices = {
  secondhand: ['实付款¥18.00', '实付款¥25.50', '实付款¥0.00', '实付款¥8.50', '实付款¥0.01', '实付款¥123456.78'],
  rental: ['实付款¥120.50', '实付款¥10.00', '实付款¥0.00'],
  errand: ['应付款¥8.50', '应付款¥15.00', '应付款¥0.00']
}

function assertRequest(request, type, side) {
  const orderSide = side === 'buy' ? 'buyer' : 'seller'
  const endpoint = type === 'secondhand' ? `/api/v1/idle/order/${orderSide}-list`
    : type === 'rental' ? `/api/v1/rental/order/${orderSide}-list`
      : '/api/v1/proxy-class-order/my-list'
  assert.equal(new URL(request.url).pathname, endpoint)
  assert.equal(request.method, 'GET')
  assert.equal(request.header.Authorization, 'Bearer test-token')
  if (type === 'errand') assert.equal(request.data.role, side === 'buy' ? 1 : 2)
}

for (const tab of ['all', 'secondhand', 'rental', 'errand']) {
  for (const side of ['buy', 'sell']) {
    test(`Mock 金额显示：${tab}/${side} 覆盖订单状态、整数、小数、字符串和零元`, async () => {
      const page = createPage(tab, side)
      const loading = page.loadOrders()
      const types = tab === 'all' ? ['secondhand', 'rental', 'errand'] : [tab]
      assert.equal(page.data.loading, true)
      assert.equal(pendingRequests.length, types.length)
      types.forEach((type, index) => {
        assertRequest(pendingRequests[index], type, side)
        succeed(pendingRequests[index], fixtures[type])
      })
      await loading

      const orders = page.data.filteredOrders
      assert.deepEqual(orders.map(priceText), types.flatMap(type => expectedPrices[type]))
      assert.deepEqual(orders.map(order => order.status), types.flatMap(type => fixtures[type].map(order => order.statusDesc)))
      assert.ok(orders.every(order => order.side === side && typeof order.price === 'number'))
      assert.deepEqual(page.data.orders, orders)
      assert.equal(page.data.loading, false)
    })
  }
}

test('Mock 刷新订单后更新金额，不保留上次显示值', async () => {
  const page = createPage('secondhand')
  let loading = page.loadOrders()
  succeed(pendingRequests[0], [{ id: 1, actualPaid: 10, status: 0, statusDesc: '待付款' }])
  await loading
  assert.equal(priceText(page.data.filteredOrders[0]), '实付款¥10.00')

  loading = page.loadOrders()
  succeed(pendingRequests[1], [{ id: 1, actualPaid: '12.50', status: 3, statusDesc: '已完成' }])
  await loading
  assert.equal(priceText(page.data.filteredOrders[0]), '实付款¥12.50')
  assert.equal(page.data.filteredOrders[0].status, '已完成')
})

test('Mock 空订单列表清空已有金额且结束加载', async () => {
  const page = createPage('secondhand')
  let loading = page.loadOrders()
  succeed(pendingRequests[0], fixtures.secondhand)
  await loading
  assert.equal(page.data.filteredOrders.length, 6)

  loading = page.loadOrders()
  succeed(pendingRequests[1], [])
  await loading
  assert.deepEqual(page.data.filteredOrders, [])
  assert.deepEqual(page.data.orders, [])
  assert.equal(page.data.loading, false)
})

test('Mock 全部订单中一个接口失败，其余订单金额仍可显示', async t => {
  t.mock.method(console, 'error', () => {})
  const page = createPage()
  const loading = page.loadOrders()
  succeed(pendingRequests[0], fixtures.secondhand)
  pendingRequests[1].fail({ errMsg: 'request:fail timeout' })
  succeed(pendingRequests[2], fixtures.errand)
  await loading

  assert.deepEqual(page.data.filteredOrders.map(priceText), [
    ...expectedPrices.secondhand, ...expectedPrices.errand
  ])
  assert.equal(page.data.loading, false)
})
