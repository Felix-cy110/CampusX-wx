const test = require('node:test')
const assert = require('node:assert/strict')

let pendingRequests = []
let navigations = []
let toasts = []
const storage = new Map([['token', 'test-token']])

global.wx = {
  getStorageSync(key) { return storage.get(key) || '' },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  request(options) { pendingRequests.push(options) },
  showToast(options) { toasts.push(options) },
  showLoading() {},
  hideLoading() {},
  navigateTo(options) {
    navigations.push(options.url)
    if (options.success) options.success({})
  },
  redirectTo(options) {
    navigations.push(options.url)
    if (options.success) options.success({})
  }
}

global.getApp = function () {
  return { globalData: { isJoinedSchool: true } }
}
global.getCurrentPages = function () {
  return [{ route: 'pages/publish-post/publish-post', options: { mode: 'secondhand' } }]
}

const settlement = require('../utils/settlementAccount')

function reset() {
  pendingRequests = []
  navigations = []
  toasts = []
  storage.delete(settlement.RETURN_URL_KEY)
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

test('只有汇付确认 ACTIVE 时才允许继续发布', async function () {
  reset()
  const result = settlement.ensureSettlementAccountActive()
  succeed(0, { status: 'ACTIVE', canPublish: true })

  assert.equal(await result, true)
  assert.equal(navigations.length, 0)
  assert.equal(storage.has(settlement.RETURN_URL_KEY), false)
})

test('审核中时保存原发布页并跳转结算账户页', async function () {
  reset()
  const result = settlement.ensureSettlementAccountActive()
  succeed(0, { status: 'PENDING', canPublish: false })

  assert.equal(await result, false)
  assert.equal(
    storage.get(settlement.RETURN_URL_KEY),
    '/pages/publish-post/publish-post?mode=secondhand'
  )
  assert.match(navigations[0], /^\/pages\/settlement-account\/settlement-account\?returnUrl=/)
  assert.equal(toasts[0].title, '结算账户审核中')
})

test('状态查询失败时保持禁止发布且不跳错页面', async function () {
  reset()
  const result = settlement.ensureSettlementAccountActive()
  pendingRequests[0].fail({ errMsg: 'timeout' })

  assert.equal(await result, false)
  assert.equal(navigations.length, 0)
  assert.equal(toasts[0].title, '连接服务器超时，请切换网络后重试')
})
