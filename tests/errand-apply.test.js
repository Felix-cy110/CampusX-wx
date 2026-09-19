const test = require('node:test')
const assert = require('node:assert/strict')

let definition
let requests
let modals
let toasts
let navigations
let loading
let token
const app = { globalData: { isJoinedSchool: true, userInfo: { uid: '7' } } }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/index/index' }]
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: key => key === 'token' ? token : '',
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 390 }),
  getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32, left: 290 }),
  request: options => requests.push(options),
  showModal: options => modals.push(options),
  showToast: options => toasts.push(options),
  showLoading: () => { loading = true },
  hideLoading: () => { loading = false },
  navigateTo(options) {
    navigations.push(options)
    if (options.success) options.success({})
    if (options.complete) options.complete({})
  }
}

require('../pages/index/index')
const indexDefinition = definition
require('../pages/errand-detail/errand-detail')
const detailDefinition = definition
require('../pages/order/order')
const orderDefinition = definition
const { resetAuthNavigation } = require('../utils/auth')

function createPage(entry, demandId = '9007199254740993') {
  requests = []
  modals = []
  toasts = []
  navigations = []
  loading = false
  token = 'test-token'
  app.globalData.isJoinedSchool = true
  resetAuthNavigation()
  const pageDefinition = entry === '首页' ? indexDefinition : detailDefinition
  const demand = { id: demandId, title: '测试跑腿', reward: 12, user: { uid: '8' } }
  const page = {
    ...pageDefinition,
    data: { ...structuredClone(pageDefinition.data), errandList: [demand], demand },
    setData(updates) { Object.assign(this.data, updates) }
  }
  page.tap = () => entry === '首页'
    ? page.grabErrand({ currentTarget: { dataset: { id: String(demandId) } } })
    : page.applyOrder()
  page.isApplying = () => !!(page.data.errandApplyingId || page.data.applying)
  return page
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

for (const entry of ['首页', '详情页']) {
  test(`${entry}确认接单后发送真实需求ID，后端成功后进入接单方订单页`, async () => {
    const page = createPage(entry)
    const application = page.tap()
    assert.equal(modals.length, 1)
    assert.match(modals[0].content, /测试跑腿.*12.*等待发布者确认/)
    assert.equal(requests.length, 0)
    assert.equal(page.isApplying(), true)
    await page.tap()
    assert.equal(modals.length, 1)

    modals[0].success({ confirm: true })
    await flush()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://xixutech.cn/api/v1/proxy-class-order/apply')
    assert.equal(requests[0].method, 'POST')
    assert.deepEqual(requests[0].data, { demandId: '9007199254740993' })
    assert.equal(requests[0].header.Authorization, 'Bearer test-token')
    assert.equal(toasts.length, 0)
    assert.equal(navigations.length, 0)
    assert.equal(loading, true)
    await page.tap()
    assert.equal(requests.length, 1)
    assert.equal(modals.length, 1)

    requests[0].success({ data: { code: 200, data: '901' } })
    await application
    assert.equal(toasts.at(-1).title, '申请已提交，待发布者确认')
    assert.equal(navigations.at(-1).url, '/pages/order/order?tab=errand&side=sell')
    assert.equal(page.isApplying(), false)
    assert.equal(loading, false)
  })

  test(`${entry}取消或无法打开确认框时不发请求，并允许再次点击`, async () => {
    for (const failed of [false, true]) {
      const page = createPage(entry)
      const application = page.tap()
      if (failed) modals[0].fail({ errMsg: 'showModal:fail' })
      else modals[0].success({ confirm: false })
      await application
      assert.equal(requests.length, 0)
      assert.equal(navigations.length, 0)
      assert.equal(page.isApplying(), false)
      if (failed) assert.equal(toasts.at(-1).title, '无法打开接单确认，请重试')
      else assert.equal(toasts.length, 0)

      const retry = page.tap()
      assert.equal(modals.length, 2)
      modals[1].success({ confirm: false })
      await retry
    }
  })

  test(`${entry}业务拒绝或网络失败时展示原因，不报成功，解除锁定后可重试`, async () => {
    for (const failure of [
      { code: 2603, message: '仅限本校接单' },
      { code: 2601, message: '需求帖不存在' },
      { code: 2602, message: '需求帖非招募中状态' },
      { code: 2605, message: '已申请过该订单' },
      { code: 3104, message: '请先开通汇付结算账户' },
      { code: 3105, message: '汇付结算账户审核中，请审核通过后再发布' },
      { code: 3106, message: '汇付结算账户开通失败，请重新提交资料' },
      { errMsg: 'request:fail timeout', message: '连接服务器超时，请切换网络后重试' }
    ]) {
      const page = createPage(entry)
      const originalDemand = structuredClone(page.data.demand)
      const application = page.tap()
      modals[0].success({ confirm: true })
      await flush()
      if (failure.errMsg) requests[0].fail({ errMsg: failure.errMsg })
      else requests[0].success({ data: failure })
      await application
      assert.equal(toasts.length, 1)
      assert.equal(toasts[0].title, failure.message)
      assert.equal(navigations.length, 0)
      assert.equal(page.isApplying(), false)
      assert.equal(loading, false)
      assert.deepEqual(page.data.demand, originalDemand)

      const retry = page.tap()
      modals[1].success({ confirm: true })
      await flush()
      assert.equal(requests.length, 2)
      requests[1].success({ data: { code: 200, data: 902 } })
      await retry
      assert.equal(navigations.at(-1).url, '/pages/order/order?tab=errand&side=sell')
    }
  })

  test(`${entry}不能申请自己发布的跑腿`, async () => {
    const page = createPage(entry)
    page.data.demand.user.uid = 7
    await page.tap()
    assert.equal(toasts.at(-1).title, '不能接自己发布的跑腿')
    assert.equal(modals.length, 0)
    assert.equal(requests.length, 0)
    assert.equal(page.isApplying(), false)
  })

  test(`${entry}未登录或校园资料未完善时进入对应页面，不提交申请`, async () => {
    for (const incomplete of [false, true]) {
      const page = createPage(entry)
      if (incomplete) app.globalData.isJoinedSchool = false
      else token = ''
      await page.tap()
      assert.equal(navigations.at(-1).url, incomplete ? '/pages/complete-info/complete-info' : '/pages/login/login')
      assert.equal(modals.length, 0)
      assert.equal(requests.length, 0)
      assert.equal(page.isApplying(), false)
    }
  })
}

test('首页兼容卡片数字ID与事件字符串ID，发送后端原始ID', async () => {
  const page = createPage('首页', 17)
  const application = page.tap()
  modals[0].success({ confirm: true })
  await flush()
  assert.deepEqual(requests[0].data, { demandId: 17 })
  requests[0].success({ data: { code: 200, data: 901 } })
  await application
})

test('供给详情仍进入联系流程，不调用需求接单接口', async () => {
  const page = createPage('详情页')
  page.data.detailType = 'supply'
  let contacted = false
  page.contactUser = () => { contacted = true }
  await page.tap()
  assert.equal(contacted, true)
  assert.equal(modals.length, 0)
  assert.equal(requests.length, 0)
})

test('模拟截图中距开始9分钟：加载需求、提前申请、进入接单方列表并显示待确认订单', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 19, 17, 0).getTime() })
  const page = createPage('首页', 17)
  page.data.errandList = []
  const list = page.loadErrands()
  assert.equal(requests[0].url, 'https://xixutech.cn/api/v1/proxy-class-demand/list')
  requests[0].success({ data: { code: 200, data: { list: [{
    id: 17,
    userId: 8,
    courseName: '空城计',
    classTime: [2026, 9, 19, 17, 9],
    fee: 1,
    onlySameSchool: 1
  }] } } })
  await list
  assert.equal(page.data.errandList[0].countdown, '距开始还剩 9分钟')

  const application = page.tap()
  modals[0].success({ confirm: true })
  await flush()
  assert.equal(requests[1].url, 'https://xixutech.cn/api/v1/proxy-class-order/apply')
  assert.deepEqual(requests[1].data, { demandId: 17 })
  requests[1].success({ data: { code: 200, data: 901 } })
  await application

  const target = new URL(navigations.at(-1).url, 'https://mini-program.test')
  assert.equal(target.pathname, '/pages/order/order')
  const orderPage = {
    ...orderDefinition,
    data: structuredClone(orderDefinition.data),
    setData(updates) { Object.assign(this.data, updates) }
  }
  orderPage.onLoad(Object.fromEntries(target.searchParams))
  assert.equal(orderPage.data.currentTab, 'errand')
  assert.equal(orderPage.data.currentSide, 'sell')
  assert.equal(requests[2].url, 'https://xixutech.cn/api/v1/proxy-class-order/my-list')
  assert.deepEqual(requests[2].data, { role: 2, pageNum: 1, pageSize: 50 })
  requests[2].success({ data: { code: 200, data: { list: [{
    orderId: 901,
    demandId: 17,
    courseName: '空城计',
    fee: 1,
    status: -1,
    statusDesc: '待需求方确认'
  }] } } })
  await flush()
  assert.equal(orderPage.data.filteredOrders.length, 1)
  assert.equal(orderPage.data.filteredOrders[0].id, 901)
  assert.equal(orderPage.data.filteredOrders[0].status, '待需求方确认')
  assert.equal(orderPage.data.filteredOrders[0].content, '空城计')
  assert.equal(requests.length, 3)
})
