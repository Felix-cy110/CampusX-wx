const test = require('node:test')
const assert = require('node:assert/strict')

const app = {}
let appDefinition
let definition
let storage
let requests
let pages
let feedResponse
let toasts
const ownSchool = { uid: '18', campusId: '320', school: '南京中医药大学' }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/index/index' }]
global.App = value => { appDefinition = value }
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => storage.get(key) || '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
  getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32, left: 290 }),
  showLoading() {},
  hideLoading() {},
  showToast(options) { toasts.push(options) },
  navigateTo(options) { if (options.success) options.success({}) },
  navigateBack() {},
  request(options) {
    requests.push(options)
    // 用户资料请求由用例控制返回时机，其他接口立即返回空列表。
    if (!options.url.endsWith('/user/me')) {
      const data = /\/post\/(feed|list)$/.test(options.url)
        ? feedResponse : { list: [], nextCursor: null }
      options.success({ data: { code: 200, data } })
    }
  }
}

require('../app')
require('../pages/index/index')
const indexDefinition = definition
require('../pages/select-school/select-school')
const selectSchoolDefinition = definition
const { resetUnreadState } = require('../utils/unread')

test.beforeEach(() => {
  storage = new Map([['token', 'test-token'], ['userInfo', { ...ownSchool }]])
  requests = []
  pages = []
  toasts = []
  feedResponse = { list: [], nextCursor: null }
  Object.assign(app, appDefinition, {
    sessionReady: undefined,
    sessionValidation: undefined,
    globalData: { ...structuredClone(appDefinition.globalData), isLoggedIn: true,
      isJoinedSchool: true, userInfo: { ...ownSchool } }
  })
  resetUnreadState()
})

test.afterEach(async () => {
  await new Promise(resolve => setImmediate(resolve))
  pages.forEach(page => page.onUnload())
})

function createHome() {
  const page = {
    ...indexDefinition,
    data: structuredClone(indexDefinition.data),
    setData(updates) { Object.assign(this.data, updates) },
    loadActivityBanner() {},
    loadCampusData() {},
    loadTeacherRatings() {},
    loadSupplies() {}
  }
  pages.push(page)
  page.onLoad()
  page.onShow()
  return page
}

function chooseSchool(page, id, name) {
  page.switchSchool()
  selectSchoolDefinition.selectSchool({ currentTarget: { dataset: { id, name } } })
  page.onShow()
}

function lastFeedRequest() {
  return requests.filter(req => /\/post\/(feed|list)$/.test(req.url)).at(-1)
}

async function completeSession(vo = {}) {
  const req = requests.filter(req => req.url.endsWith('/user/me')).at(-1)
  req.success({ data: { code: 200, data: {
    userId: ownSchool.uid, campusId: ownSchool.campusId, campusName: ownSchool.school, ...vo
  } } })
  await app.sessionReady
}

test('首次进入首页显示账号学校，旧的选校缓存不会覆盖学校和推荐流', () => {
  storage.set('selectedSchool', JSON.stringify({ id: 7, name: '南京信息工程大学' }))
  const page = createHome()
  assert.equal(page.data.schoolInfo.name, '南京中医药大学')
  assert.equal(page.data.schoolInfo.id, ownSchool.campusId)
  assert.equal(page.data.browsingCampusId, '')
  assert.ok(lastFeedRequest().url.endsWith('/post/feed'))
  assert.equal(lastFeedRequest().data.targetCampusId, undefined)
})

test('用户资料晚于首页返回时，自动刷新学校，且只请求一次用户资料', async () => {
  storage.set('userInfo', { uid: ownSchool.uid, campusId: ownSchool.campusId })
  app.onLaunch()
  const page = createHome()
  assert.equal(page.data.schoolInfo.name, '学校信息加载中')
  assert.equal(lastFeedRequest(), undefined)
  assert.equal(page.data.feedLoading, true)
  await completeSession()
  assert.equal(page.data.schoolInfo.name, '南京中医药大学')
  assert.equal(requests.filter(req => req.url.endsWith('/user/me')).length, 1)
  assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 1)
})

test('本地缓存学校过时时，等待账号资料同步后才加载推荐，避免旧校名配新校帖子', async () => {
  storage.set('userInfo', { ...ownSchool, campusId: '900', school: '旧学校' })
  app.onLaunch()
  const page = createHome()
  page.onShow()
  assert.equal(lastFeedRequest(), undefined)
  await completeSession()
  assert.equal(page.data.schoolInfo.name, ownSchool.school)
  assert.equal(page.data.schoolInfo.id, ownSchool.campusId)
  assert.ok(lastFeedRequest().url.endsWith('/post/feed'))
  assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 1)
})

test('主动切换使用真实学校ID，返回首页保留浏览学校，切回本校恢复推荐流', () => {
  const page = createHome()
  chooseSchool(page, '9007199254740993', '南京信息工程大学')
  assert.equal(page.data.schoolInfo.name, '南京信息工程大学')
  assert.equal(page.data.schoolInfo.id, '9007199254740993')
  assert.equal(lastFeedRequest().data.targetCampusId, '9007199254740993')
  assert.ok(lastFeedRequest().url.endsWith('/post/list'))
  assert.equal(storage.has('selectedSchool'), false)
  assert.equal(app.globalData.userInfo.school, '南京中医药大学')
  page.onShow()
  assert.equal(page.data.schoolInfo.name, '南京信息工程大学')
  chooseSchool(page, Number(ownSchool.campusId), ownSchool.school)
  assert.equal(page.data.schoolInfo.name, '南京中医药大学')
  assert.equal(page.data.browsingCampusId, '')
  assert.ok(lastFeedRequest().url.endsWith('/post/feed'))
})

test('取消选校不改变当前学校，相同名称但不同ID的学校仍能切换', () => {
  const page = createHome()
  page.switchSchool()
  page.onShow()
  assert.equal(page.data.schoolInfo.name, ownSchool.school)
  assert.equal(page.data.browsingCampusId, '')
  chooseSchool(page, '321', ownSchool.school)
  assert.equal(page.data.browsingCampusId, '321')
  assert.equal(lastFeedRequest().data.targetCampusId, '321')
})

test('主动切换后，迟到的启动资料响应不会覆盖浏览学校', async () => {
  app.onLaunch()
  const page = createHome()
  chooseSchool(page, '900', '南京大学')
  await completeSession()
  assert.equal(page.data.schoolInfo.name, '南京大学')
  assert.equal(page.data.browsingCampusId, '900')
})

test('用户更换账号或所属学校后返回首页，重置浏览范围并同步新学校', () => {
  const page = createHome()
  chooseSchool(page, '900', '南京大学')
  app.globalData.userInfo = { ...ownSchool, uid: '19' }
  page.onShow()
  assert.equal(page.data.schoolInfo.name, ownSchool.school)
  assert.equal(page.data.browsingCampusId, '')
  chooseSchool(page, '900', '南京大学')
  app.globalData.userInfo = { uid: '19', campusId: '400', school: '江苏大学' }
  page.onShow()
  assert.equal(page.data.schoolInfo.name, '江苏大学')
  assert.equal(page.data.browsingCampusId, '')
  assert.ok(lastFeedRequest().url.endsWith('/post/feed'))
})

test('账号资料原对象被更新学校时，也能识别范围变化并清空旧帖子', async () => {
  const page = createHome()
  await new Promise(resolve => setImmediate(resolve))
  page.setData({ feedList: [{ id: 'old' }], feedCursor: 'old-cursor' })
  app.globalData.userInfo.campusId = '400'
  app.globalData.userInfo.school = '江苏大学'
  page.onShow()
  assert.equal(page.data.schoolInfo.name, '江苏大学')
  assert.deepEqual(page.data.feedList, [])
  assert.equal(page.data.feedCursor, null)
  assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 2)
})

test('游客登录完善资料后回到已有首页，立即显示所属学校', () => {
  storage.delete('token')
  app.globalData.isLoggedIn = false
  app.globalData.isJoinedSchool = false
  app.globalData.userInfo = {}
  const page = createHome()
  assert.equal(page.data.schoolInfo.name, '未登录')
  storage.set('token', 'new-token')
  app.globalData.isLoggedIn = true
  page.onShow()
  assert.equal(page.data.schoolInfo.name, '未加入学校')
  app.globalData.isJoinedSchool = true
  app.globalData.userInfo = { ...ownSchool }
  page.onShow()
  assert.equal(page.data.schoolInfo.name, ownSchool.school)
  assert.equal(page.data.browsingCampusId, '')
})

test('旧学校缓存且启动校验失败时，不加载帖子或误显示跨校分界线', async () => {
  storage.set('userInfo', { ...ownSchool, campusId: '900', school: '旧学校' })
  feedResponse = { list: [{ postId: 'post-1', targetCampusId: ownSchool.campusId,
    schoolName: ownSchool.school }], nextCursor: null }
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(lastFeedRequest(), undefined)
  assert.deepEqual(page.data.feedList, [])
  assert.equal(page.data.crossSchoolStartIndex, -1)
  assert.equal(page.data.feedLoading, false)
  assert.equal(page.data.schoolLoadFailed, true)
  assert.equal(page.data.feedLoadFailed, true)

  // 切分类、返回首页、发布刷新均不能绕过失败的学校校验。
  app.globalData.homeContentNeedsRefresh = true
  page.onShow()
  page.onPostCategoryTap({ currentTarget: { dataset: { id: '2' } } })
  await page.loadFeed()
  assert.equal(lastFeedRequest(), undefined)
  assert.equal(app.globalData.homeContentNeedsRefresh, true)
})

test('校验失败后下拉刷新先重试资料，成功后学校和帖子一致且只加载一次', async () => {
  storage.set('userInfo', { ...ownSchool, campusId: '900', school: '旧学校' })
  feedResponse = { list: [{ postId: 'post-1', targetCampusId: ownSchool.campusId,
    schoolName: ownSchool.school }], nextCursor: null }
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  await new Promise(resolve => setImmediate(resolve))
  app.globalData.homeContentNeedsRefresh = true
  const refresh = page.refreshFeed()
  const duplicateRefresh = page.refreshFeed()
  page.onShow()
  assert.equal(requests.filter(req => req.url.endsWith('/user/me')).length, 2)
  assert.equal(lastFeedRequest(), undefined)
  assert.equal(page.data.feedRefreshing, true)
  await completeSession()
  await Promise.all([refresh, duplicateRefresh])
  assert.equal(page.data.schoolInfo.id, ownSchool.campusId)
  assert.equal(page.data.schoolInfo.name, ownSchool.school)
  assert.equal(page.data.feedList[0].campusId, ownSchool.campusId)
  assert.equal(page.data.crossSchoolStartIndex, -1)
  assert.equal(page.data.feedLoadFailed, false)
  assert.equal(page.data.schoolLoadFailed, false)
  assert.equal(page.data.feedRefreshing, false)
  assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 1)
  assert.equal(app.globalData.homeContentNeedsRefresh, false)
})

test('下拉重试仍失败时停止加载并保留重试入口，不提示刷新成功', async () => {
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  await new Promise(resolve => setImmediate(resolve))
  const refresh = page.refreshFeed()
  requests.filter(req => req.url.endsWith('/user/me')).at(-1).fail({ errMsg: 'timeout' })
  await refresh
  assert.equal(lastFeedRequest(), undefined)
  assert.equal(page.data.feedLoading, false)
  assert.equal(page.data.feedRefreshing, false)
  assert.equal(page.data.schoolLoadFailed, true)
  assert.equal(toasts.some(toast => toast.title === '刷新成功'), false)
})

test('校验失败后重建首页仍阻止帖子请求，下拉可继续恢复', async () => {
  app.onLaunch()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  const page = createHome()
  assert.equal(lastFeedRequest(), undefined)
  assert.equal(page.data.schoolLoadFailed, true)
  const refresh = page.refreshFeed()
  await completeSession()
  await refresh
  assert.equal(page.data.schoolLoadFailed, false)
  assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 1)
})

test('其他页面成功重新校验同一学校后，返回首页自动恢复帖子', async () => {
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  await new Promise(resolve => setImmediate(resolve))
  app.validateStoredSession(storage.get('token'))
  await completeSession()
  page.onShow()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.schoolLoadFailed, false)
  assert.equal(page.data.feedLoadFailed, false)
  assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 1)
})

test('校验失败后同一账号重新登录，新 Token 不受旧校验失败影响', async () => {
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  await new Promise(resolve => setImmediate(resolve))
  storage.set('token', 'new-token')
  page.onShow()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(lastFeedRequest().header.Authorization, 'Bearer new-token')
  assert.equal(page.data.schoolLoadFailed, false)
  assert.equal(page.data.feedLoading, false)
})

for (const outcome of ['成功', '失败']) {
  test(`重试期间切换账号，旧资料请求迟到${outcome}不会覆盖或阻塞新账号`, async () => {
    app.onLaunch()
    const page = createHome()
    requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
    await app.sessionReady
    await new Promise(resolve => setImmediate(resolve))
    const refresh = page.refreshFeed()
    const oldRequest = requests.filter(req => req.url.endsWith('/user/me')).at(-1)
    storage.set('token', 'new-token')
    app.globalData.userInfo = { uid: '19', campusId: '400', school: '江苏大学' }
    storage.set('userInfo', app.globalData.userInfo)
    app.validateStoredSession('new-token')
    page.onShow()
    await completeSession({ userId: '19', campusId: '400', campusName: '江苏大学' })
    await new Promise(resolve => setImmediate(resolve))
    if (outcome === '成功') {
      oldRequest.success({ data: { code: 200, data: { userId: '18', campusId: '900', campusName: '旧学校' } } })
    } else {
      oldRequest.fail({ errMsg: 'timeout' })
    }
    await refresh
    assert.equal(app.globalData.userInfo.uid, '19')
    assert.equal(app.globalData.userInfo.school, '江苏大学')
    assert.equal(page.data.schoolInfo.name, '江苏大学')
    assert.equal(page.data.feedLoading, false)
    assert.equal(page.data.schoolLoadFailed, false)
    assert.equal(lastFeedRequest().header.Authorization, 'Bearer new-token')
    assert.equal(requests.filter(req => req.url.endsWith('/post/feed')).length, 1)
  })
}

test('下拉重试期间卸载首页，资料返回不更新页面或加载帖子', async () => {
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  await new Promise(resolve => setImmediate(resolve))
  const refresh = page.refreshFeed()
  page.onUnload()
  page.setData = () => assert.fail('已卸载页面不应更新')
  await completeSession()
  await refresh
  assert.equal(lastFeedRequest(), undefined)
})

test('首页卸载后，迟到的资料响应不再更新该页面', async () => {
  storage.set('userInfo', { uid: ownSchool.uid, campusId: ownSchool.campusId })
  app.onLaunch()
  const page = createHome()
  await new Promise(resolve => setImmediate(resolve))
  page.onUnload()
  page.setData = () => assert.fail('已卸载页面不应更新')
  await completeSession()
  assert.equal(app.globalData.userInfo.school, ownSchool.school)
})
