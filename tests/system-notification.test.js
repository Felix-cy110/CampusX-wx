const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition
let pendingRequests = []
let navigations = []
global.getCurrentPages = function () { return [] }

global.getApp = function () {
  return { globalData: { isJoinedSchool: true, notificationCounts: { system: 1 } } }
}
global.Page = function (definition) { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() {
    return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }
  },
  request(options) { pendingRequests.push(options) },
  navigateBack() {},
  showLoading() {},
  hideLoading() {},
  navigateTo(options) { navigations.push(options) }
}

require('../pages/system-msg/system-msg')
test.beforeEach(() => require('../utils/unread').resetUnreadState())

function createPage() {
  return {
    data: { ...pageDefinition.data },
    setData(updates) { Object.assign(this.data, updates) },
    markSystemRead: pageDefinition.markSystemRead
  }
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

test('系统消息展示已支付订单并按实际展示时间标记已读', async function () {
  pendingRequests = []
  const page = createPage()
  const loadPromise = pageDefinition.loadMessages.call(page)

  assert.match(pendingRequests[0].url, /\/api\/v1\/notification\/system$/)
  succeed(0, {
    list: [{
      cursorId: 8,
      orderId: 8,
      orderNo: 'I202609050001',
      productTitle: '高数教材',
      buyerNickname: '买家同学',
      amount: 20,
      orderStatus: 1,
      orderStatusDesc: '待发货',
      createdAt: '2026-09-05T12:00:00'
    }],
    hasMore: false,
    nextCursor: null
  })
  await loadPromise

  assert.equal(page.data.messages.length, 1)
  assert.equal(page.data.messages[0].title, '商品已付款')
  assert.match(page.data.messages[0].msg, /高数教材/)
  assert.match(pendingRequests[1].url, /\/api\/v1\/notification\/read\/system$/)
  assert.deepEqual(pendingRequests[1].data, { readThrough: '2026-09-05T12:00:00' })
})

test('Mock退款申请提醒独立于付款消息，显示待处理文案并进入卖家订单', async function () {
  pendingRequests = []
  navigations = []
  const page = createPage()
  const loading = pageDefinition.loadMessages.call(page)
  succeed(0, {
    list: [
      { cursorId: 10, orderId: 8, eventType: 'IDLE_REFUND_APPLIED', buyerNickname: '买家同学',
        productTitle: '高数教材', amount: 20, orderNo: 'I8', createdAt: '2026-09-17T12:00:00' },
      { cursorId: 9, orderId: 8, eventType: 'IDLE_PAID', productTitle: '高数教材', amount: 20,
        createdAt: '2026-09-16T12:00:00' }
    ], hasMore: false
  })
  await loading
  assert.equal(page.data.messages.length, 2)
  assert.equal(page.data.messages[0].title, '买家申请退款')
  assert.match(page.data.messages[0].msg, /买家同学.*高数教材.*申请退款/)
  assert.match(page.data.messages[0].msg, /及时处理/)
  assert.match(page.data.messages[0].msg, /订单号：I8/)
  assert.equal(page.data.messages[1].title, '商品已付款')
  assert.notEqual(page.data.messages[0].id, page.data.messages[1].id)
  assert.deepEqual(pendingRequests[1].data, { readThrough: '2026-09-17T12:00:00' })
  pageDefinition.goToOrder.call({ hideDetail() {} })
  assert.equal(navigations[0].url, '/pages/order/order?tab=secondhand&side=sell')
})
