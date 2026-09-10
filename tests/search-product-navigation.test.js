const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

let definition
let requests = []
let navigations = []
let storage = new Map()
const app = { globalData: { isLoggedIn: true, isJoinedSchool: true, userInfo: { uid: '7', campusId: 100 } } }
global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/search-result/search-result' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync(key) { return storage.get(key) },
  setStorageSync(key, value) { storage.set(key, value) },
  removeStorageSync(key) { storage.delete(key) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  request(options) { requests.push(options) },
  navigateTo(options) { navigations.push(options); if (options.success) options.success({}) },
  showLoading() {},
  hideLoading() {},
  showToast() {}
}
require('../pages/search-result/search-result')
const { resetAuthNavigation } = require('../utils/auth')

function createPage() {
  requests = []
  navigations = []
  storage = new Map([['token', 'test-token'], ['userInfo', { uid: '7', campusId: 100 }]])
  resetAuthNavigation()
  return Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(updates) {
      for (const [key, value] of Object.entries(updates)) {
        const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
        const property = parts.pop()
        const target = parts.reduce((object, part) => object[part], this.data)
        target[property] = value
      }
    }
  })
}

async function loadResults(page) {
  page.doSearch('测试商品')
  assert.match(requests[0].url, /\/api\/v1\/search\/global$/)
  requests[0].success({ data: { code: 200, data: {
    posts: { list: [{ id: 23, title: '关联动态' }] },
    rentalProducts: { list: [{ id: 23, title: '租赁相机', status: 2 }] },
    idleProducts: { list: [
      { id: 23, title: '二手书', subType: 1, status: 1 },
      { id: '9007199254740993', title: '二手台灯', subType: 2, status: 1 }
    ] },
    users: { list: [] }
  } } })
  await new Promise(resolve => setImmediate(resolve))
}

function tap(page, index) {
  const post = page.data.filteredPosts[index]
  page.onTapPost({ currentTarget: { dataset: { id: post.id, type: post.type, index } } })
}

test('搜索卡片提供跳转处理器所需的 ID、类型和索引', () => {
  const template = fs.readFileSync(path.join(__dirname, '../pages/search-result/search-result.wxml'), 'utf8')
  const card = template.match(/<view\s+class="post-card"[\s\S]*?>/)[0]
  assert.match(card, /bindtap="onTapPost"/)
  assert.match(card, /data-id="{{item.id}}"/)
  assert.match(card, /data-type="{{item.type}}"/)
  assert.match(card, /data-index="{{index}}"/)
})

test('混合搜索中相同 ID 的帖子、租赁、二手商品分别打开正确详情', async () => {
  const page = createPage()
  await loadResults(page)

  tap(page, 0)
  assert.equal(navigations.at(-1).url, '/pages/post-detail/post-detail?id=23')
  assert.equal(storage.get('selectedPostDetail').type, 'post')
  tap(page, 1)
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=23&type=rental')
  tap(page, 2)
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=23&type=book')
  assert.equal(storage.get('selectedPostDetail').type, 'post')
})

test('其他闲置详情使用 item 类型，并保留字符串商品 ID', async () => {
  const page = createPage()
  await loadResults(page)
  page.applyTabFilter('二手')
  tap(page, 1)
  assert.equal(navigations.at(-1).url, '/pages/market-detail/market-detail?id=9007199254740993&type=item')
})

test('筛选切换后的过期点击事件不会打开同 ID 的另一类商品', async () => {
  const page = createPage()
  await loadResults(page)
  page.applyTabFilter('二手')
  page.onTapPost({ currentTarget: { dataset: { id: 23, type: 'post', index: 0 } } })
  assert.equal(navigations.length, 0)
})

test('帖子点赞同步不会覆盖具有同 ID 的二手商品', async () => {
  const page = createPage()
  await loadResults(page)
  page.applyTabFilter('二手')
  storage.set('postLikeUpdate', { id: 23, liked: true, likeCount: 99 })
  page.onShow()
  assert.equal(page.data.filteredPosts[0].liked, false)
  assert.equal(page.data.filteredPosts[0].stats.likes, 0)
})
