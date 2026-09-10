const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition
let pendingRequests = []
let navigations = []
let toasts = []
let storage = new Map()
const app = { globalData: {} }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/post-detail/post-detail' }]
global.Page = definition => { pageDefinition = definition }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  getSystemInfoSync() { return { statusBarHeight: 24, windowWidth: 390 } },
  getMenuButtonBoundingClientRect() { return { top: 28, height: 32, left: 290 } },
  request(options) {
    if (options.url.includes('/follow/count/')) {
      options.success({ data: { code: 200, data: { followedByMe: false } } })
    } else if (options.url.includes('/favorite/list')) {
      options.success({ data: { code: 200, data: { list: [] } } })
    } else {
      pendingRequests.push(options)
    }
  },
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  showToast(options) { toasts.push(options) },
  showLoading() {},
  hideLoading() {}
}

require('../pages/post-detail/post-detail')
const postDefinition = pageDefinition
require('../pages/market-detail/market-detail')
const marketDefinition = pageDefinition
const { resetAuthNavigation } = require('../utils/auth')
const { resetFollowState } = require('../utils/follow')

function createPage(definition = postDefinition) {
  return Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(updates) {
      for (const [key, value] of Object.entries(updates)) {
        const parts = key.split('.')
        const property = parts.pop()
        const target = parts.reduce((result, part) => result[part], this.data)
        target[property] = value
      }
    },
    // 评论列表与商品可购买状态无关，详情与导航仍使用真实请求封装。
    loadComments() {}
  })
}

function reset() {
  pendingRequests = []
  navigations = []
  toasts = []
  storage = new Map([['token', 'test-token']])
  app.globalData = {
    isLoggedIn: true,
    isJoinedSchool: true,
    userInfo: { uid: '7', campusId: 100 }
  }
  resetAuthNavigation()
  resetFollowState()
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

const postDetail = {
  id: 987654,
  userId: 18,
  nickname: '测试卖家',
  title: '二手台灯',
  content: '自取台灯',
  sourceType: 'IDLE_PRODUCT',
  sourceId: 812,
  publisherCampusId: 100,
  status: 1,
  imageUrls: []
}

function succeed(index, overrides = {}) {
  pendingRequests[index].success({
    data: { code: 200, data: { ...postDetail, ...overrides } }
  })
}

function assertProductNavigation(page) {
  const navigationCount = navigations.length
  page.goBuy()
  assert.equal(navigations.length, navigationCount + 1)
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=812')
  assert.equal(toasts.length, 0)
}

function enterProductDetail() {
  const target = new URL(navigations.at(-1).url, 'https://mini.example')
  const page = createPage(marketDefinition)
  page.onLoad(Object.fromEntries(target.searchParams))
  return page
}

test('关闭的二手关联帖仍能查看商品，已售出原因以商品详情接口为准', async () => {
  reset()
  const page = createPage()
  page.loadPostDetail('987654')
  assert.equal(pendingRequests[0].url, 'https://xixutech.cn/api/post/987654')
  succeed(0, { status: 2 })
  await flush()

  assert.equal(page.data.post.status, 2)
  assert.equal(page.data.post.sourceId, 812)
  assertProductNavigation(page)

  const market = enterProductDetail()
  assert.equal(pendingRequests[1].url, 'https://xixutech.cn/api/v1/idle/product/book/812')
  pendingRequests[1].success({ data: { code: 2902, message: '商品已售出' } })
  await flush()
  assert.equal(market.data.loading, false)
  assert.equal(market.data.loadError, '商品已售出')
  assert.deepEqual(market.data.item, {})
  assert.equal(pendingRequests.length, 2)
})

test('正常二手关联帖仍用商品 ID 跳转购买详情', async () => {
  reset()
  const page = createPage()
  page.loadPostDetail('987654')
  succeed(0)
  await flush()

  assert.equal(page.data.post.status, 1)
  page.goBuy()
  assert.equal(navigations.length, 1)
  assert.equal(navigations[0].url, '/pages/market-detail/market-detail?id=812')
  assert.equal(toasts.length, 0)
})

test('首次显示不重复请求，从购买页返回刷新为闭帖状态后仍能查看商品', async () => {
  reset()
  storage.set('selectedPostDetail', {
    id: 987654,
    sourceId: 812,
    sourceType: 'IDLE_PRODUCT',
    status: 1,
    user: { uid: 18 }
  })
  const page = createPage()
  page.onLoad({ id: '987654' })
  page.onShow()
  assert.equal(pendingRequests.length, 1)
  succeed(0)
  await flush()

  page.goBuy()
  assert.equal(navigations.length, 1)
  page.onHide()
  page.onShow()
  assert.equal(pendingRequests.length, 2)
  assert.equal(pendingRequests[1].url, 'https://xixutech.cn/api/post/987654')
  succeed(1, { status: 2 })
  await flush()

  assert.equal(page.data.post.status, 2)
  assertProductNavigation(page)
})

test('商品重新上架后旧关联帖仍关闭，仍可通过原商品 ID 加载最新可购买商品', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '987654' })
  page.onShow()
  succeed(0, { status: 2 })
  await flush()
  assert.equal(page.data.post.status, 2)

  page.onHide()
  page.onShow()
  assert.equal(pendingRequests.length, 2)
  // 重新上架会创建新关联帖；旧帖子本身仍保持关闭。
  succeed(1, { status: 2 })
  await flush()

  assert.equal(page.data.post.status, 2)
  assertProductNavigation(page)
  const market = enterProductDetail()
  assert.equal(pendingRequests[2].url, 'https://xixutech.cn/api/v1/idle/product/book/812')
  pendingRequests[2].success({ data: { code: 422, message: '该商品不是二手书' } })
  await flush()
  assert.equal(pendingRequests[3].url, 'https://xixutech.cn/api/v1/idle/product/item/812')
  pendingRequests[3].success({
    data: {
      code: 200,
      data: {
        productId: 812,
        sellerId: 18,
        sellerNickname: '测试卖家',
        title: '重新上架的台灯',
        price: '20.00',
        conditionLevel: 2,
        deliveryType: 1,
        imageUrls: ['/images/lamp.jpg']
      }
    }
  })
  await flush()

  assert.equal(market.data.loading, false)
  assert.equal(market.data.loadError, '')
  assert.equal(market.data.productType, 'item')
  assert.equal(market.data.item.id, 812)
  assert.equal(market.data.item.title, '重新上架的台灯')
  assert.equal(market.data.item.price, 20)
  assert.equal(pendingRequests.length, 4)
  assert.equal(page.data.post.status, 2)
})

test('普通帖子返回页面时无需为二手商品状态额外请求详情', async () => {
  reset()
  const page = createPage()
  page.onLoad({ id: '987654' })
  page.onShow()
  succeed(0, { sourceType: '', sourceId: null })
  await flush()
  page.onHide()
  page.onShow()
  await flush()
  assert.equal(pendingRequests.length, 1)
})
