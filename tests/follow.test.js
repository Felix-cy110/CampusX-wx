const test = require('node:test')
const assert = require('node:assert/strict')

let pendingRequests = []

global.wx = {
  getStorageSync: function () { return 'test-token' },
  getAccountInfoSync: function () {
    return { miniProgram: { envVersion: 'develop' } }
  },
  request: function (options) {
    pendingRequests.push(options)
  }
}
global.getApp = function () { return { globalData: {} } }

const follow = require('../utils/follow')

function reset() {
  pendingRequests = []
  follow.resetFollowState()
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

function fail(index, message) {
  pendingRequests[index].fail({ errMsg: message || 'network fail' })
}

test('同一用户的并发状态查询只发送一次请求', async function () {
  reset()

  const first = follow.refreshFollowStatus(20)
  const second = follow.refreshFollowStatus('20')

  assert.equal(first, second)
  assert.equal(pendingRequests.length, 1)
  succeed(0, { followedByMe: true, followerCount: 3, followingCount: 4 })

  const status = await first
  assert.equal(status.stale, false)
  assert.equal(follow.getKnownFollowStatus(20, false), true)
})

test('关注操作开始前的旧查询不能覆盖成功结果', async function () {
  reset()

  const staleRefresh = follow.refreshFollowStatus(20)
  const mutation = follow.requestFollowChange(20, false)
  assert.equal(pendingRequests.length, 2)

  succeed(1, null)
  assert.equal(await mutation, true)
  assert.equal(follow.getKnownFollowStatus(20, false), true)

  succeed(0, { followedByMe: false, followerCount: 0, followingCount: 0 })
  const staleStatus = await staleRefresh
  assert.equal(staleStatus.stale, true)
  assert.equal(follow.getKnownFollowStatus(20, false), true)
})

test('关注操作期间的查询会等待写入完成后再读取', async function () {
  reset()

  const mutation = follow.requestFollowChange(20, false)
  const refresh = follow.refreshFollowStatus(20)
  assert.equal(pendingRequests.length, 1)

  succeed(0, null)
  await mutation
  await Promise.resolve()
  assert.equal(pendingRequests.length, 2)

  succeed(1, { followedByMe: true, followerCount: 1, followingCount: 0 })
  const status = await refresh
  assert.equal(status.stale, false)
  assert.equal(status.followedByMe, true)
})

test('快速重复点击不会发出第二个关注请求', async function () {
  reset()

  const first = follow.requestFollowChange(20, false)
  const second = follow.requestFollowChange(20, false)
  assert.equal(second, null)
  assert.equal(pendingRequests.length, 1)

  succeed(0, null)
  assert.equal(await first, true)
})

test('详情旧快照会被关注操作版本拒绝', async function () {
  reset()

  const version = follow.getFollowVersion(20)
  const mutation = follow.requestFollowChange(20, false)
  succeed(0, null)
  await mutation

  assert.equal(follow.applyFollowSnapshot(20, version, false), false)
  assert.equal(follow.getKnownFollowStatus(20, false), true)
})

test('写请求失败但服务端已到目标状态时按成功处理', async function () {
  reset()

  const first = follow.requestFollowChange(20, false)
  fail(0, 'timeout')
  await Promise.resolve()
  assert.equal(pendingRequests.length, 2)
  succeed(1, { followedByMe: true, followerCount: 1, followingCount: 0 })

  assert.equal(await first, true)
  assert.equal(follow.getKnownFollowStatus(20, false), true)
})

test('写入和回查都失败后释放操作锁并允许重试', async function () {
  reset()

  const first = follow.requestFollowChange(20, false)
  fail(0, 'timeout')
  await Promise.resolve()
  fail(1, 'timeout')
  await assert.rejects(first)

  const retry = follow.requestFollowChange(20, false)
  assert.notEqual(retry, null)
  assert.equal(pendingRequests.length, 3)
  succeed(2, null)
  assert.equal(await retry, true)
})

test('切换会话后不接受旧用户的迟到状态', async function () {
  reset()

  const oldRefresh = follow.refreshFollowStatus(20)
  follow.resetFollowState()
  succeed(0, { followedByMe: true, followerCount: 1, followingCount: 0 })

  const status = await oldRefresh
  assert.equal(status.stale, true)
  assert.equal(follow.getKnownFollowStatus(20, false), false)
})
