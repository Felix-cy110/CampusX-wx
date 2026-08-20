const test = require('node:test')
const assert = require('node:assert/strict')

let pendingRequests
let app

global.getApp = function () { return app }
global.getCurrentPages = function () { return [] }

global.wx = {
  getStorageSync: function () { return '' },
  getAccountInfoSync: function () {
    return { miniProgram: { envVersion: 'develop' } }
  },
  request: function (options) {
    pendingRequests.push(options)
  }
}

const unread = require('../utils/unread')

function reset(counts) {
  pendingRequests = []
  app = {
    globalData: {
      notificationCounts: Object.assign({
        likes: 0,
        followers: 0,
        comments: 0,
        system: 0,
        chatUnread: 0
      }, counts || {}),
      _notificationCountsLoaded: true
    }
  }
  unread.resetUnreadState()
}

function succeed(index, data) {
  pendingRequests[index].success({ data: { code: 200, data } })
}

function fail(index, message) {
  pendingRequests[index].fail({ errMsg: message || 'network fail' })
}

test('并发刷新共享同一个统计请求', async function () {
  reset()

  const first = unread.refreshUnreadCounts()
  const second = unread.refreshUnreadCounts()

  assert.equal(pendingRequests.length, 1)
  assert.equal(first, second)

  succeed(0, { likes: 2, followers: 1, comments: 0, system: 0, chatUnread: 3 })
  const counts = await first
  assert.deepEqual(counts, { likes: 2, followers: 1, comments: 0, system: 0, chatUnread: 3 })
})

test('已读期间的旧统计响应不会覆盖最终权威结果', async function () {
  reset({ chatUnread: 10 })

  const staleRefresh = unread.refreshUnreadCounts()
  const markRead = unread.markChatConversationRead({
    otherUserId: 20,
    unreadCount: 5
  })

  assert.equal(app.globalData.notificationCounts.chatUnread, 5)
  assert.equal(pendingRequests.length, 2)

  // 这是已读请求之前取得的旧快照，必须丢弃。
  succeed(0, { likes: 0, followers: 0, comments: 0, system: 0, chatUnread: 10 })
  await staleRefresh
  assert.equal(app.globalData.notificationCounts.chatUnread, 5)

  succeed(1, null)
  await Promise.resolve()
  assert.equal(pendingRequests.length, 3)

  // 已读 5 条的同时，另一个会话新增 1 条，服务端权威结果是 6。
  succeed(2, { likes: 0, followers: 0, comments: 0, system: 0, chatUnread: 6 })
  await markRead
  assert.equal(app.globalData.notificationCounts.chatUnread, 6)
})

test('已读请求失败后通过权威统计恢复乐观扣减', async function () {
  reset({ chatUnread: 10 })

  const markRead = unread.markChatConversationRead({
    otherUserId: 20,
    unreadCount: 5
  })
  assert.equal(app.globalData.notificationCounts.chatUnread, 5)

  fail(0, 'timeout')
  await Promise.resolve()
  assert.equal(pendingRequests.length, 2)
  succeed(1, { likes: 0, followers: 0, comments: 0, system: 0, chatUnread: 10 })

  await assert.rejects(markRead)
  assert.equal(app.globalData.notificationCounts.chatUnread, 10)
})

test('退出或切换账号后不接受旧会话的迟到响应', async function () {
  reset({ likes: 3 })
  const oldRefresh = unread.refreshUnreadCounts()
  const oldRequest = pendingRequests[0]

  app = {
    globalData: {
      notificationCounts: { likes: 0, followers: 0, comments: 0, system: 0, chatUnread: 0 },
      _notificationCountsLoaded: false
    }
  }
  unread.resetUnreadState()

  oldRequest.success({
    data: {
      code: 200,
      data: { likes: 99, followers: 0, comments: 0, system: 0, chatUnread: 0 }
    }
  })
  await oldRefresh

  assert.equal(app.globalData.notificationCounts.likes, 0)
  assert.equal(app.globalData._notificationCountsLoaded, false)
})

test('未读订阅会同步权威刷新、乐观已读和会话重置', async function () {
  reset({ likes: 2, chatUnread: 3 })
  const totals = []
  const unsubscribe = unread.subscribeUnreadCounts(function (counts) {
    totals.push(unread.getUnreadTotal(counts))
  })

  assert.deepEqual(totals, [5])

  const refresh = unread.refreshUnreadCounts()
  succeed(0, { likes: 1, followers: 1, comments: 0, system: 0, chatUnread: 2 })
  await refresh
  assert.deepEqual(totals, [5, 4])

  const markRead = unread.markNotificationRead('likes')
  assert.deepEqual(totals, [5, 4, 3])
  succeed(1, null)
  await Promise.resolve()
  succeed(2, { likes: 0, followers: 1, comments: 0, system: 0, chatUnread: 2 })
  await markRead
  assert.deepEqual(totals, [5, 4, 3, 3])

  app.globalData.notificationCounts = {
    likes: 0,
    followers: 0,
    comments: 0,
    system: 0,
    chatUnread: 0
  }
  unread.resetUnreadState()
  assert.deepEqual(totals, [5, 4, 3, 3, 0])

  unsubscribe()
})

test('未读总数会归一化异常数据', function () {
  reset()
  assert.equal(unread.getUnreadTotal({
    likes: '2',
    followers: -1,
    comments: 1.9,
    system: 'bad',
    chatUnread: 3
  }), 6)
})

test('完整会话列表校准会阻止旧统计响应恢复已读数字', async function () {
  reset({ chatUnread: 1 })

  const staleRefresh = unread.refreshUnreadCounts()
  unread.reconcileChatUnread(0)
  assert.equal(app.globalData.notificationCounts.chatUnread, 0)

  // 校准前发出的响应必须丢弃，并自动再取一次当前权威值。
  succeed(0, { likes: 0, followers: 0, comments: 0, system: 0, chatUnread: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pendingRequests.length, 2)
  assert.equal(app.globalData.notificationCounts.chatUnread, 0)

  succeed(1, { likes: 0, followers: 0, comments: 0, system: 0, chatUnread: 0 })
  await staleRefresh
  assert.equal(app.globalData.notificationCounts.chatUnread, 0)
})

test('多个未读显示实例会同时收到更新，解绑后停止接收', function () {
  reset({ chatUnread: 1 })
  const first = []
  const second = []
  const unsubscribeFirst = unread.subscribeUnreadCounts(counts => first.push(counts.chatUnread))
  const unsubscribeSecond = unread.subscribeUnreadCounts(counts => second.push(counts.chatUnread))

  unread.reconcileChatUnread(0)
  unsubscribeFirst()
  unread.reconcileChatUnread(2)
  unsubscribeSecond()

  assert.deepEqual(first, [1, 0])
  assert.deepEqual(second, [1, 0, 2])
})
