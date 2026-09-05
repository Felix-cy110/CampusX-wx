const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition
let pendingRequests = []

global.getApp = function () {
  return { globalData: { notificationCounts: { system: 1 } } }
}
global.Page = function (definition) { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() {
    return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }
  },
  request(options) { pendingRequests.push(options) },
  navigateBack() {}
}

require('../pages/system-msg/system-msg')

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
