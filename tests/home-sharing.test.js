const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const app = { globalData: {} }
let definition
let shareMenus

global.getApp = () => app
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: () => '',
  showShareMenu: options => shareMenus.push(options)
}
require('../pages/index/index')
const { guardNavigation } = require('../utils/auth')

function createHome() {
  return {
    ...definition,
    data: { ...structuredClone(definition.data), isJoinedSchool: false },
    syncUserSchool: () => false,
    updateInboxUnreadIndicator() {},
    _syncPostLikeUpdate() {}
  }
}

test.beforeEach(() => {
  shareMenus = []
  app.globalData = {}
})

test('首页每次显示时同时开放好友和朋友圈分享', () => {
  const page = createHome()
  page.onShow()
  page.onShow()
  assert.equal(shareMenus.length, 2)
  assert.deepEqual(shareMenus[0].menus, ['shareAppMessage', 'shareTimeline'])
  assert.deepEqual(shareMenus[1].menus, ['shareAppMessage', 'shareTimeline'])
})

test('好友分享使用已注册的公开首页和固定品牌图片', () => {
  const page = createHome()
  const share = page.onShareAppMessage({ from: 'menu' })
  assert.equal(share.title, 'X校圈｜发现校园生活')
  assert.equal(share.path, '/pages/index/index')
  assert.equal(guardNavigation(share.path), true)
  assert.ok(require('../app.json').pages.includes(share.path.slice(1)))
  assert.equal(share.imageUrl, '/images/share-home.png')
  assert.equal(fs.existsSync(path.join(__dirname, '..', share.imageUrl)), true)
})

test('朋友圈分享不携带账号、学校或页面查询信息', () => {
  const page = createHome()
  page.data.userInfo = { uid: 'private-uid', phone: 'private-phone', school: 'private-school' }
  page.data.browsingCampusId = 'private-campus'
  page.options = { token: 'private-token', inviteCode: 'private-invite' }
  const share = page.onShareTimeline()
  assert.deepEqual(share, {
    title: 'X校圈｜发现校园生活',
    query: '',
    imageUrl: '/images/share-home.png'
  })
  assert.equal(JSON.stringify(page.onShareAppMessage()).includes('private-'), false)
})

test('分享回调返回独立对象，不受调用方修改影响', () => {
  const page = createHome()
  const share = page.onShareAppMessage()
  share.title = '修改后的标题'
  const timeline = page.onShareTimeline()
  timeline.query = 'uid=1'
  assert.equal(page.onShareAppMessage().title, 'X校圈｜发现校园生活')
  assert.equal(page.onShareTimeline().query, '')
})

test('不提供分享菜单接口时仍可正常显示首页', () => {
  const showShareMenu = wx.showShareMenu
  delete wx.showShareMenu
  try {
    assert.doesNotThrow(() => createHome().onShow())
  } finally {
    wx.showShareMenu = showShareMenu
  }
})
