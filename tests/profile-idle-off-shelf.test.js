const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition
let pendingRequests = []
let toasts = []

global.getApp = function () {
  return { globalData: { userInfo: { uid: '7', nickname: '测试用户' } } }
}
global.Page = function (definition) { pageDefinition = definition }
global.wx = {
  getStorageSync() { return 'test-token' },
  getAccountInfoSync() {
    return { miniProgram: { envVersion: 'develop', appId: 'wx-test-app' } }
  },
  request(options) { pendingRequests.push(options) },
  showLoading() {},
  hideLoading() {},
  showToast(options) { toasts.push(options) }
}

require('../pages/profile/profile')

function createPage() {
  return {
    data: {
      ...pageDefinition.data,
      userInfo: { uid: '7', nickname: '测试用户' },
      filteredContentList: []
    },
    setData(updates) { Object.assign(this.data, updates) },
    _mapIdleToCard: pageDefinition._mapIdleToCard
  }
}

function reset() {
  pendingRequests = []
  toasts = []
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

test('个人页刷新时不会重新展示已下架商品', async function () {
  reset()
  const page = createPage()
  const resultPromise = pageDefinition._fetchMyIdleProducts.call(page, 1)

  assert.equal(pendingRequests.length, 1)
  assert.match(pendingRequests[0].url, /\/api\/v1\/idle\/product\/my-list$/)

  succeed(0, {
    list: [
      { productId: 11, status: 1, title: '在售商品' },
      { productId: 12, status: 2, title: '已下架商品' },
      { productId: 13, status: 3, title: '已售出商品' },
      { productId: 14, status: 6, title: '交易中商品' }
    ],
    pages: 1
  })

  const result = await resultPromise
  assert.deepEqual(result.list.map(item => item._backendId), [11, 13])
  assert.deepEqual(result.list.map(item => item.itemStatus), ['available', 'sold'])
})

test('非上架商品不能通过本地删卡片伪装成下架成功', function () {
  reset()
  const page = createPage()
  const soldItem = {
    id: 'idle_13',
    _backendId: 13,
    _backendType: 'idle',
    _backendStatus: 3,
    itemStatus: 'sold'
  }
  page.data.filteredContentList = [soldItem]

  pageDefinition._deleteItem.call(page, soldItem, soldItem.id)

  assert.equal(pendingRequests.length, 0)
  assert.deepEqual(page.data.filteredContentList, [soldItem])
  assert.equal(toasts.at(-1).title, '当前商品不可下架')
})

test('上架商品必须等后端确认成功后才从个人页移除', async function () {
  reset()
  const page = createPage()
  const onSaleItem = {
    id: 'idle_11',
    _backendId: 11,
    _backendType: 'idle',
    _backendStatus: 1,
    itemStatus: 'available'
  }
  page.data.filteredContentList = [onSaleItem]

  pageDefinition._deleteItem.call(page, onSaleItem, onSaleItem.id)

  assert.equal(pendingRequests.length, 1)
  assert.match(pendingRequests[0].url, /\/api\/v1\/idle\/product\/11\/off-shelf$/)
  assert.deepEqual(page.data.filteredContentList, [onSaleItem])

  succeed(0, null)
  await new Promise(resolve => setImmediate(resolve))

  assert.deepEqual(page.data.filteredContentList, [])
  assert.equal(toasts.at(-1).title, '已下架')
})
