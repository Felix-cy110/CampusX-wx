const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition
let pendingRequests = []
let allRequests = []
let navigations = []
let storage = new Map()
const app = { globalData: {} }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/market-detail/market-detail' }]
global.Page = definition => { pageDefinition = definition }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 } },
  getMenuButtonBoundingClientRect() { return { top: 28, height: 32, left: 290 } },
  request(options) {
    allRequests.push(options)
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
  showToast() {},
  showLoading() {},
  hideLoading() {}
}

require('../pages/market-detail/market-detail')
const marketDefinition = pageDefinition
require('../pages/post-detail/post-detail')
const postDefinition = pageDefinition
const { resetAuthNavigation } = require('../utils/auth')
const { resetFollowState } = require('../utils/follow')

function createPage(definition = marketDefinition, data = {}) {
  return Object.assign({}, definition, {
    data: Object.assign({}, structuredClone(definition.data), data),
    setData(updates) { Object.assign(this.data, updates) }
  })
}

function reset() {
  pendingRequests = []
  allRequests = []
  navigations = []
  storage = new Map([['token', 'test-token']])
  app.globalData = {
    isLoggedIn: true,
    isJoinedSchool: true,
    userInfo: { uid: '7', campusId: 100 }
  }
  resetAuthNavigation()
  resetFollowState()
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

function paths() {
  return pendingRequests.map(options => new URL(options.url).pathname)
}

function assertNoProductListRequest() {
  assert.equal(allRequests.some(options => /\/idle\/product\/(book|item)$/.test(new URL(options.url).pathname)), false)
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

test('帖子去购买使用关联商品 ID，无类型入口正常显示书籍详情', async () => {
  reset()
  const post = createPage(postDefinition, {
    postId: '91001',
    post: { id: 91001, sourceType: 'IDLE_PRODUCT', sourceId: 812, publisherCampusId: 100 }
  })
  post.goBuy()
  assert.equal(navigations.length, 1)
  const target = new URL(navigations[0].url, 'https://mini.example')
  assert.equal(target.pathname, '/pages/market-detail/market-detail')
  assert.equal(target.searchParams.get('id'), '812')

  const page = createPage()
  page.onLoad(Object.fromEntries(target.searchParams))
  assert.deepEqual(paths(), ['/api/v1/idle/product/book/812'])
  assert.equal(pendingRequests[0].header.Authorization, 'Bearer test-token')
  succeed(0, product)
  await flush()

  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.productType, 'book')
  assert.equal(page.data.item.id, 812)
  assert.equal(page.data.item.title, '高等数学')
  assert.equal(page.data.item.price, 25.5)
  assert.equal(page.data.item.user.name, '测试卖家')
  assert.deepEqual(page.data.item.images, ['https://xixutech.cn/images/product.jpg'])
  assert.equal(page.onShareAppMessage().path, '/pages/market-detail/market-detail?id=812&type=book')
  assertNoProductListRequest()
})

test('没有类型的闲置商品仅在后端明确返回不是二手书时切换详情接口', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '812' })
  reject(0, 422, '该商品不是二手书')
  await flush()
  assert.equal(page.data.loading, true)
  assert.deepEqual(paths(), ['/api/v1/idle/product/book/812', '/api/v1/idle/product/item/812'])
  succeed(1, { ...product, title: '台灯', category: '电器' })
  await flush()

  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.item.title, '台灯')
  assert.equal(page.data.productType, 'item')
  assert.equal(page.onShareAppMessage().path, '/pages/market-detail/market-detail?id=812&type=item')
  assertNoProductListRequest()
})

test('已知闲置商品类型直接请求对应详情', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '812', type: 'item' })
  assert.deepEqual(paths(), ['/api/v1/idle/product/item/812'])
  succeed(0, { ...product, title: '台灯' })
  await flush()
  assert.equal(page.data.item.title, '台灯')
  assert.equal(page.data.productType, 'item')
  assert.equal(page.data.loading, false)
  assertNoProductListRequest()
})

test('带错闲置类型的书籍入口可以根据明确类型错误切换为书籍', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '812', type: 'item' })
  reject(0, 422, '该商品不是闲置物品')
  await flush()
  assert.deepEqual(paths(), ['/api/v1/idle/product/item/812', '/api/v1/idle/product/book/812'])
  succeed(1, product)
  await flush()
  assert.equal(page.data.productType, 'book')
  assert.equal(page.data.item.title, '高等数学')
  assertNoProductListRequest()
})

test('网络错误保留请求工具的提示，点击重试可恢复且不重复发送请求', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '812' })
  pendingRequests[0].fail({ errMsg: 'request:fail timeout' })
  await flush()

  assert.deepEqual(paths(), ['/api/v1/idle/product/book/812'])
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '连接服务器超时，请切换网络后重试')
  assert.deepEqual(page.data.item, {})
  page.retryLoad()
  assert.equal(page.data.loading, true)
  assert.equal(page.data.loadError, '')
  page.retryLoad()
  assert.deepEqual(paths(), ['/api/v1/idle/product/book/812', '/api/v1/idle/product/book/812'])
  succeed(1, product)
  await flush()
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '')
  assert.equal(page.data.item.id, 812)
  assertNoProductListRequest()
})

for (const error of [
  { code: 2901, message: '闲置商品不存在' },
  { code: 2902, message: '商品不在上架状态' },
  { code: 2902, message: '商品正在交易中，暂不可购买' },
  { code: 2902, message: '商品已售出' },
  { code: 403, message: '暂不支持跨校购买二手商品' },
  { code: 401, message: '登录已失效，请重新登录' },
  { code: 500, message: '该商品不是二手书' }
]) {
  test('真实详情错误不切换接口或查列表，并保留原因：' + error.message + ' (' + error.code + ')', async () => {
    reset()
    const page = createPage()
    page.onLoad({ id: '812' })
    reject(0, error.code, error.message)
    await flush()
    assert.deepEqual(paths(), ['/api/v1/idle/product/book/812'])
    assert.equal(page.data.loading, false)
    assert.equal(page.data.loadError, error.message)
    assert.deepEqual(page.data.item, {})
    assertNoProductListRequest()
    if (error.code === 401) {
      assert.equal(storage.has('token'), false)
      assert.equal(navigations[0].url, '/pages/login/login')
    }
  })
}

test('类型回退后的真实错误保留原始文案，最多尝试两个详情接口', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '812' })
  reject(0, 422, '该商品不是二手书')
  await flush()
  reject(1, 2902, '商品不在上架状态')
  await flush()
  assert.equal(pendingRequests.length, 2)
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '商品不在上架状态')
  assert.deepEqual(page.data.item, {})
  assertNoProductListRequest()
})

test('两个接口都返回类型不匹配时不循环重试', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '812' })
  reject(0, 422, '该商品不是二手书')
  await flush()
  reject(1, 422, '该商品不是闲置物品')
  await flush()
  assert.equal(pendingRequests.length, 2)
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '该商品不是闲置物品')
  assertNoProductListRequest()
})

test('缺少商品 ID 时结束加载并显示参数错误，不发送请求', () => {
  reset()
  const page = createPage()
  page.onLoad({})
  assert.equal(page.data.loading, false)
  assert.equal(page.data.loadError, '参数错误')
  assert.deepEqual(page.data.item, {})
  assert.equal(allRequests.length, 0)
})
