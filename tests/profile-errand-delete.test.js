const test = require('node:test')
const assert = require('node:assert/strict')

let definition
let requests
let toasts
let modal
global.getApp = () => ({ globalData: { userInfo: { uid: '7' } } })
global.Page = value => { definition = value }
global.wx = {
  getStorageSync: () => 'test-token',
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  request: options => requests.push(options),
  showToast: options => toasts.push(options),
  showModal: options => { modal = options },
  showLoading() {},
  hideLoading() {}
}
require('../pages/profile/profile')

function createPage() {
  requests = []
  toasts = []
  modal = null
  return {
    ...definition,
    data: { ...definition.data, userInfo: { uid: '7' }, filteredContentList: [] },
    setData(updates) { Object.assign(this.data, updates) }
  }
}

for (const kind of ['demand', 'supply']) {
  test(`跑腿${kind}确认删除后发送真实ID，成功后移除，刷新后不再出现`, async () => {
    const page = createPage()
    const item = kind === 'demand'
      ? page._mapProxyDemandToCard({ id: 17, status: 4, courseName: '旧跑腿' })
      : page._mapProxySupplyToCard({ id: 17, status: 2, subjectRange: '旧供给' })
    const other = { id: 'post_17', _backendType: 'post', _backendId: 17 }
    page.data.filteredContentList = [item, other]
    page.showPostOptions({ currentTarget: { dataset: { id: item.id } } })
    page.onDeletePost()
    assert.equal(requests.length, 0)
    if (kind === 'demand') {
      assert.match(modal.content, /尚未确认的接单申请也会取消/)
      assert.match(modal.content, /已确认的订单需先处理/)
    }
    modal.success({ confirm: true })

    assert.equal(requests.length, 1)
    assert.ok(requests[0].url.endsWith(`/api/v1/proxy-class-${kind}/17`))
    assert.equal(requests[0].method, 'DELETE')
    assert.deepEqual(page.data.filteredContentList, [item, other])
    requests[0].success({ data: { code: 200, data: null } })
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(page.data.filteredContentList, [other])
    assert.equal(toasts.at(-1).title, '已删除')

    const refresh = page._fetchMyProxyItems(1)
    requests[1].success({ data: { code: 200, data: { list: [], pages: 1 } } })
    requests[2].success({ data: { code: 200, data: { list: [], pages: 1 } } })
    assert.deepEqual((await refresh).list, [])
  })

  test(`跑腿${kind}有未完成订单或网络失败时保留卡片并显示原因`, async () => {
    for (const networkFailure of [false, true]) {
      const page = createPage()
      const item = { id: `${kind}_17`, _backendType: `proxy_${kind}`, _backendId: 17 }
      page.data.filteredContentList = [item]
      const deletion = page._deleteItem(item, item.id)
      if (networkFailure) {
        requests[0].fail({ errMsg: 'request:fail timeout' })
      } else {
        requests[0].success({ data: { code: 2608, message: '该需求帖存在未完成订单' } })
      }
      await deletion
      assert.deepEqual(page.data.filteredContentList, [item])
      assert.equal(toasts.at(-1).title, networkFailure ? '连接服务器超时，请切换网络后重试' : '该需求帖存在未完成订单')
      assert.ok(toasts.every(toast => toast.title !== '已删除'))
    }
  })
}

test('取消确认不会发请求，也不会移除跑腿卡片', () => {
  const page = createPage()
  const item = page._mapProxyDemandToCard({ id: 17, status: 1 })
  page.data.filteredContentList = [item]
  page.data.selectedPostId = item.id
  page.onDeletePost()
  modal.success({ confirm: false })
  assert.equal(requests.length, 0)
  assert.deepEqual(page.data.filteredContentList, [item])
})

test('未知内容类型不能仅删除本地卡片后提示成功', () => {
  const page = createPage()
  const item = { id: 'unknown_17', _backendId: 17 }
  page.data.filteredContentList = [item]
  page._deleteItem(item, item.id)
  assert.equal(requests.length, 0)
  assert.deepEqual(page.data.filteredContentList, [item])
  assert.equal(toasts.at(-1).title, '该内容暂不支持删除')
})
