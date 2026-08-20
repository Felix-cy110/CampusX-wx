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
