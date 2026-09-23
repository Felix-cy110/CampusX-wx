const test = require('node:test')
const assert = require('node:assert/strict')

const app = {}
let appDefinition
let definition
let storage
let requests
let pages
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
  navigateTo(options) { if (options.success) options.success({}) },
  navigateBack() {},
  request(options) {
    requests.push(options)
    // 用户资料请求由用例控制返回时机，其他接口立即返回空列表。
    if (!options.url.endsWith('/user/me')) {
      options.success({ data: { code: 200, data: { list: [], nextCursor: null } } })
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
  Object.assign(app, appDefinition, {
    sessionReady: undefined,
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
  const req = requests.find(req => req.url.endsWith('/user/me'))
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
  await completeSession()
  assert.equal(page.data.schoolInfo.name, '南京中医药大学')
  assert.equal(requests.filter(req => req.url.endsWith('/user/me')).length, 1)
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

test('启动校验失败时保留用户缓存中的真实学校', async () => {
  app.onLaunch()
  const page = createHome()
  requests.find(req => req.url.endsWith('/user/me')).fail({ errMsg: 'timeout' })
  await app.sessionReady
  assert.equal(page.data.schoolInfo.name, ownSchool.school)
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
