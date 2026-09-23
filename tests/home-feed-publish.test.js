const test = require('node:test')
const assert = require('node:assert/strict')

const app = { globalData: {} }
let definition
let storage
let posts
let requests
let toasts
let pages
let publishedPage
let failFeed
let failPublish
let deferFeed
let pendingFeeds

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/index/index' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => storage.get(key) || '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop', appId: 'test-app' } }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
  getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32, left: 290 }),
  showLoading() {},
  hideLoading() {},
  showToast: options => toasts.push(options),
  navigateTo(options) {
    if (options.url.startsWith('/pages/published/published')) {
      publishedPage = createPage(publishedDefinition)
      publishedPage.onLoad({ from: 'post' })
    }
    if (options.success) options.success({})
  },
  switchTab() {},
  request(options) {
    requests.push(options)
    let data = {}
    if (/\/post\/(feed|list)$/.test(options.url)) {
      if (deferFeed) {
        pendingFeeds.push(options)
        return
      }
      if (failFeed) return options.fail({ errMsg: 'request:fail timeout' })
      data = { list: posts.filter(post => !options.data.targetCampusId ||
        String(post.targetCampusId) === String(options.data.targetCampusId)), nextCursor: null }
    } else if (options.url.endsWith('/post/publish/local')) {
      if (failPublish) return options.success({ data: { code: 500, message: '发布失败' } })
      posts.unshift({ id: '501', userId: '18', title: options.data.title, content: options.data.content,
        targetCampusId: '320', schoolName: '南京中医药大学', nickname: '测试用户', createdAt: '2026-09-24T12:00:00' })
      data = { postId: '501', needPay: false }
    }
    options.success({ data: { code: 200, data } })
  }
}

require('../pages/index/index')
const indexDefinition = definition
require('../pages/publish-post/publish-post')
const publishDefinition = definition
require('../pages/published/published')
const publishedDefinition = definition
const { resetUnreadState } = require('../utils/unread')

function createPage(entry) {
  return { ...entry, data: structuredClone(entry.data),
    setData(updates) { Object.assign(this.data, updates) } }
}

function createHome() {
  const page = createPage(indexDefinition)
  // 测试帖子发布、推荐请求和返回首页的完整链路，其余分类不发请求。
  page.loadActivityBanner = () => {}
  page.loadCampusData = () => {}
  page.loadTeacherRatings = () => {}
  page.loadSupplies = () => {}
  pages.push(page)
  page.onLoad()
  page.onShow()
  return page
}

function createPublisher() {
  const page = createPage(publishDefinition)
  page.setData({ title: '我刚发布的新帖子', content: '验证发布后回到首页可见',
    targetCampusId: '320', isCrossSchool: false, buyLotteryTicket: false, images: [] })
  return page
}

async function flush() { await new Promise(resolve => setImmediate(resolve)) }
function feedRequests() { return requests.filter(req => /\/post\/(feed|list)$/.test(req.url)) }

function notifyPublished() {
  const page = createPage(publishedDefinition)
  page.onLoad({ from: 'post' })
}

function completeFeed(index, list) {
  pendingFeeds[index].success({ data: { code: 200, data: { list, nextCursor: null } } })
}

test.beforeEach(() => {
  storage = new Map([['token', 'test-token']])
  posts = []
  requests = []
  toasts = []
  pages = []
  publishedPage = null
  failFeed = false
  failPublish = false
  deferFeed = false
  pendingFeeds = []
  app.globalData = { isLoggedIn: true, isJoinedSchool: true,
    userInfo: { uid: '18', campusId: '320', school: '南京中医药大学' } }
  resetUnreadState()
})

test.afterEach(async () => {
  await flush()
  pages.forEach(page => page.onUnload())
})

test('本校发帖成功后从已发布页返回已有首页，重新请求并显示自己的新帖', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const home = createHome()
  await flush()
  assert.equal(home.data.feedList.length, 0)
  await createPublisher().publishPost()
  t.mock.timers.tick(1500)
  assert.ok(publishedPage)
  publishedPage.finish()
  home.onShow()
  await flush()
  assert.equal(home.data.schoolInfo.name, '南京中医药大学')
  assert.deepEqual(home.data.feedList.map(post => post.id), ['501'])
  assert.equal(home.data.feedList[0].user.uid, '18')
  assert.equal(feedRequests().length, 2)
  home.onShow()
  assert.equal(feedRequests().length, 2, '发布刷新通知只能消费一次')
})

test('手动刷新显示接口返回的自己的帖子，成功后才提示刷新成功', async () => {
  const home = createHome()
  await flush()
  posts.push({ id: '502', userId: '18', title: '我的旧帖子', schoolName: '南京中医药大学' })
  await home.refreshFeed()
  await flush()
  assert.deepEqual(home.data.feedList.map(post => post.id), ['502'])
  assert.equal(toasts.at(-1).title, '刷新成功')
  assert.equal(home.data.feedRefreshing, false)
})

test('推荐请求失败时保留原列表，不再误报刷新成功', async () => {
  posts.push({ id: '502', userId: '18', title: '我的旧帖子' })
  const home = createHome()
  await flush()
  failFeed = true
  await home.refreshFeed()
  await flush()
  assert.deepEqual(home.data.feedList.map(post => post.id), ['502'])
  assert.equal(toasts.some(toast => toast.title === '刷新成功'), false)
  assert.equal(home.data.feedRefreshing, false)
})

test('发布返回时保持用户主动选择的浏览学校，不把本校帖子塞进其他学校列表', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const home = createHome()
  home.switchSchool()
  storage.set('selectedSchool', JSON.stringify({ id: '900', name: '南京大学' }))
  home.onShow()
  await flush()
  await createPublisher().publishPost()
  t.mock.timers.tick(1500)
  publishedPage.finish()
  home.onShow()
  await flush()
  assert.equal(home.data.schoolInfo.name, '南京大学')
  assert.equal(feedRequests().at(-1).data.targetCampusId, '900')
  assert.equal(feedRequests().length, 3)
  assert.deepEqual(home.data.feedList, [])
})

test('发布失败不会进入成功页或通知首页重新加载', async () => {
  const home = createHome()
  await flush()
  failPublish = true
  await createPublisher().publishPost()
  home.onShow()
  await flush()
  assert.equal(publishedPage, null)
  assert.equal(posts.length, 0)
  assert.equal(feedRequests().length, 1)
})

test('发布后首次创建首页及请求期间再次显示只发送一次推荐，成功前保留通知', async () => {
  notifyPublished()
  deferFeed = true
  const home = createHome()
  home.onShow()
  assert.equal(feedRequests().length, 1)
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  completeFeed(0, [{ id: '501', userId: '18', title: '我的新帖' }])
  await flush()
  assert.deepEqual(home.data.feedList.map(post => post.id), ['501'])
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
  home.onShow()
  assert.equal(feedRequests().length, 1)
})

test('发布后自动刷新失败会保留通知，恢复网络再次进入首页后重试', async () => {
  const home = createHome()
  await flush()
  posts.push({ id: '501', userId: '18', title: '我的新帖' })
  notifyPublished()
  failFeed = true
  home.onShow()
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  assert.deepEqual(home.data.feedList, [])
  failFeed = false
  home.onShow()
  await flush()
  assert.equal(feedRequests().length, 3)
  assert.deepEqual(home.data.feedList.map(post => post.id), ['501'])
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
})

test('自动刷新失败后手动刷新成功也能确认通知，返回首页不再重复请求', async () => {
  const home = createHome()
  await flush()
  notifyPublished()
  failFeed = true
  home.onShow()
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  failFeed = false
  posts.push({ id: '501', userId: '18' })
  await home.refreshFeed()
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
  home.onShow()
  assert.equal(feedRequests().length, 3)
  assert.deepEqual(home.data.feedList.map(post => post.id), ['501'])
})

test('旧刷新完成不能确认请求发出之后的新发布通知', async () => {
  const home = createHome()
  await flush()
  notifyPublished()
  deferFeed = true
  home.onShow()
  notifyPublished()
  completeFeed(0, [{ id: '501', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  home.onShow()
  assert.equal(pendingFeeds.length, 2)
  completeFeed(1, [{ id: '502', userId: '18' }, { id: '501', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
  assert.deepEqual(home.data.feedList.map(post => post.id), ['502', '501'])
})

test('切换学校不会复用旧学校的刷新请求，旧响应不能确认新请求的通知', async () => {
  notifyPublished()
  deferFeed = true
  const home = createHome()
  home.switchSchool()
  storage.set('selectedSchool', JSON.stringify({ id: '900', name: '南京大学' }))
  home.onShow()
  assert.equal(pendingFeeds.length, 2)
  assert.equal(pendingFeeds[1].data.targetCampusId, '900')
  completeFeed(0, [{ id: '501', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  completeFeed(1, [{ id: '601', userId: '19', schoolName: '南京大学' }])
  await flush()
  assert.equal(home.data.schoolInfo.name, '南京大学')
  assert.deepEqual(home.data.feedList.map(post => post.id), ['601'])
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
})

test('请求过程中再次发布，返回首页会请求新版本且忽略旧响应', async () => {
  notifyPublished()
  deferFeed = true
  const home = createHome()
  notifyPublished()
  home.onShow()
  assert.equal(pendingFeeds.length, 2)
  completeFeed(0, [{ id: '501', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  completeFeed(1, [{ id: '502', userId: '18' }, { id: '501', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
  assert.deepEqual(home.data.feedList.map(post => post.id), ['502', '501'])
})

test('手动刷新覆盖自动请求后失败，返回首页不会复用已经失效的自动请求', async () => {
  notifyPublished()
  deferFeed = true
  const home = createHome()
  const manualRefresh = home.refreshFeed()
  pendingFeeds[1].fail({ errMsg: 'request:fail timeout' })
  await manualRefresh
  home.onShow()
  assert.equal(pendingFeeds.length, 3)
  completeFeed(0, [{ id: 'old', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
  completeFeed(2, [{ id: '501', userId: '18' }])
  await flush()
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
  assert.deepEqual(home.data.feedList.map(post => post.id), ['501'])
})
