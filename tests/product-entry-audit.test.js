const test = require('node:test')
const assert = require('node:assert/strict')

let definition
let navigations = []
let storage = new Map()
const app = { globalData: { isLoggedIn: true, isJoinedSchool: true, userInfo: { uid: '7', campusId: 100 } } }
global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/profile/profile' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  showLoading() {}, hideLoading() {}
}
require('../pages/index/index')
const indexDefinition = definition
require('../pages/profile/profile')
const profileDefinition = definition
require('../pages/my-market/my-market')
const marketDefinition = definition
const { resetAuthNavigation } = require('../utils/auth')

function createPage(pageDefinition) {
  navigations = []
  storage = new Map([['token', 'test-token']])
  resetAuthNavigation()
  return Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    setData(updates) { Object.assign(this.data, updates) }
  })
}

test('首页二手书和其他闲置入口保留真实商品 ID，不使用列表位置或显示标题', () => {
  const page = createPage(indexDefinition)
  const book = page._mapIdleBookVO({ productId: '9007199254740993', title: '二手书' })
  page.goToBookDetail({ currentTarget: { dataset: { id: book.id } } })
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=9007199254740993')
  const item = page._mapIdleItemVO({ productId: '812', title: '闲置台灯' })
  page.goToMarketDetail({ currentTarget: { dataset: { id: item.id } } })
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=812')
})

test('个人主页发布及收藏入口使用商品 ID，避开 idle_ 显示 ID 和收藏记录 ID', () => {
  const page = createPage(profileDefinition)
  const published = page._mapIdleToCard({ productId: '812', title: '闲置台灯', status: 1 })
  const favorite = page._mapFavoriteToCard({ favoriteId: 55, targetId: '813', targetType: 2, title: '二手教材' })
  page.data.filteredContentList = [published, favorite]

  page.goToPostDetail({ currentTarget: { dataset: { id: published.id } } })
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=812')
  page.goToPostDetail({ currentTarget: { dataset: { id: favorite.id } } })
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=813')
})

test('我的二手入口携带商品类型，已售出商品仍指向原商品 ID', () => {
  const page = createPage(marketDefinition)
  for (const [subType, type] of [[1, 'book'], [2, 'item']]) {
    const item = page.mapSellerProduct({ productId: '812', subType, status: 3, title: '已售出商品' })
    page.goToDetail({ currentTarget: { dataset: { id: item.id, type: item.type } } })
    assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=812&type=' + type)
  }
})
