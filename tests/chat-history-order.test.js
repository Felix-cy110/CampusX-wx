const test = require('node:test')
const assert = require('node:assert/strict')

// 执行真实聊天页、request 和 STOMP 客户端，只替换微信网络及页面运行环境。
let pageDefinition
let historyRequests
let sockets
let pages
const app = { globalData: {} }

global.getApp = () => app
global.getCurrentPages = () => [{ route: 'pages/chat/chat' }]
global.Page = definition => { pageDefinition = definition }
global.wx = {
  getStorageSync(key) { return key === 'token' ? 'mock-token' : '' },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
  getSystemInfoSync() { return { statusBarHeight: 24 } },
  getMenuButtonBoundingClientRect() { return { top: 28, height: 32 } },
  request(options) {
    const path = new URL(options.url).pathname
    if (path === '/api/v1/chat/history' || path === '/api/v1/chat/messages') {
      historyRequests.push(options)
    } else if (path === '/api/v1/follow/count/20') {
      options.success({ data: { code: 200, data: { followedByMe: true } } })
    } else if (path === '/api/v1/chat/read' || path === '/api/v1/notification/count') {
      options.success({ data: { code: 200, data: {} } })
    } else {
      throw new Error('未预期的请求：' + path)
    }
  },
  connectSocket() {
    const socket = createMockSocket()
    sockets.push(socket)
    return socket
  },
  showToast() {}
}

require('../pages/chat/chat')
const { resetFollowState } = require('../utils/follow')
const { resetUnreadState } = require('../utils/unread')

function createMockSocket() {
  const handlers = {}
  const subscriptions = new Map()
  return {
    frames: [],
    closed: false,
    onOpen(callback) { handlers.open = callback },
    onMessage(callback) { handlers.message = callback },
    onClose(callback) { handlers.close = callback },
    onError(callback) { handlers.error = callback },
    send({ data }) {
      const raw = Buffer.from(data).toString('utf8')
      assert.ok(raw.endsWith('\0'))
      const separator = raw.indexOf('\n\n')
      const [command, ...lines] = raw.slice(0, separator).split('\n')
      const headers = Object.fromEntries(lines.map(line => {
        const colon = line.indexOf(':')
        return [line.slice(0, colon), line.slice(colon + 1)]
      }))
      const body = raw.slice(separator + 2, -1)
      this.frames.push({ command, headers, body })
      if (command === 'SUBSCRIBE') subscriptions.set(headers.destination, headers.id)
    },
    open() {
      handlers.open()
      assert.equal(this.frames[0].command, 'CONNECT')
      assert.equal(this.frames[0].headers.Authorization, 'Bearer mock-token')
      handlers.message({ data: 'CONNECTED\nversion:1.2\n\n\0' })
    },
    receive(message) {
      const subscription = subscriptions.get('/queue/user/10')
      assert.ok(subscription, '聊天页应订阅当前用户的消息队列')
      handlers.message({
        data: 'MESSAGE\nsubscription:' + subscription + '\n\n' + JSON.stringify(message) + '\0'
      })
    },
    close() {
      this.closed = true
      if (handlers.close) handlers.close()
    }
  }
}

test.beforeEach(t => {
  historyRequests = []
  sockets = []
  pages = []
  app.globalData = { userInfo: { uid: '10', avatar: '/images/my-avatar.png' } }
  resetFollowState()
  resetUnreadState()
  // 控制滚动和已读防抖计时，测试无需等待真实的 200/300ms。
  t.mock.timers.enable({ apis: ['setTimeout'] })
})

test.afterEach(() => {
  pages.forEach(page => page.onUnload())
})

function enter(options = {}) {
  const page = Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    setData(updates, callback) {
      Object.assign(this.data, updates)
      if (callback) callback()
    }
  })
  pages.push(page)
  page.onLoad({ userId: '20', ...options })
  assert.equal(page.data.pageError, false)
  assert.equal(page.data.loading, true)
  const socket = sockets.at(-1)
  assert.ok(socket)
  socket.open()
  assert.equal(page._stompClient.isConnected(), true)
  return { page, socket }
}

function message(id, content = '消息' + id, overrides = {}) {
  return {
    id,
    conversationId: '10_20',
    senderId: id % 2 === 0 ? 10 : 20,
    receiverId: id % 2 === 0 ? 20 : 10,
    msgType: 1,
    content,
    createdAt: '2026-09-18T20:17:00',
    ...overrides
  }
}

async function respond(messages, hasMore = false) {
  const request = historyRequests.at(-1)
  const last = messages.at(-1)
  request.success({
    data: {
      code: 200,
      data: {
        messages,
        nextCursor: hasMore ? last.createdAt : null,
        nextId: hasMore ? last.id : null,
        hasMore
      }
    }
  })
  await new Promise(resolve => setImmediate(resolve))
}

function contents(page) { return page.data.messages.map(msg => msg.content) }
function ids(page) { return page.data.messages.map(msg => msg.id) }

function sendText(page, socket, content) {
  page.onInput({ detail: { value: content } })
  page.sendMessage()
  const frame = socket.frames.at(-1)
  assert.equal(frame.command, 'SEND')
  assert.equal(frame.headers.destination, '/app/chat/20/send')
  assert.deepEqual(JSON.parse(frame.body), {
    receiverId: 20, orderId: null, orderType: null, msgType: 1, content
  })
  assert.equal(page.data.inputValue, '')
}

test('对照：旧接口升序响应能复现退出重进后新消息出现在顶部', async () => {
  const old = message(1, '旧消息')
  const sent = message(2, '222')
  const first = enter()
  await respond([old])
  sendText(first.page, first.socket, '222')
  first.socket.receive(sent)
  assert.deepEqual(contents(first.page), ['旧消息', '222'])
  first.page.onUnload()
  assert.equal(first.socket.closed, true)

  const reopened = enter()
  // 故意回放修复前 /history 的升序响应，确认此测试确实能触发视频里的问题。
  await respond([old, sent])
  assert.deepEqual(contents(reopened.page), ['222', '旧消息'])
  assert.notDeepEqual(contents(reopened.page), contents(first.page))
})

const entries = [
  { name: '商品详情入口', options: {}, path: '/api/v1/chat/history' },
  { name: '收件箱入口', options: { convId: '10_20' }, path: '/api/v1/chat/messages' }
]

for (const entry of entries) {
  test(entry.name + '：发送、收消息、两次退出重进后顺序保持一致', async () => {
    const records = [message(1, '旧消息', { createdAt: '2026-09-18T20:10:00' })]
    const first = enter(entry.options)
    assert.equal(new URL(historyRequests[0].url).pathname, entry.path)
    assert.equal(historyRequests[0].header.Authorization, 'Bearer mock-token')
    await respond(records.slice().reverse())

    sendText(first.page, first.socket, '222')
    records.push(message(2, '222'))
    first.socket.receive(records.at(-1))
    assert.deepEqual(contents(first.page), ['旧消息', '222'])
    first.page.onUnload()

    const second = enter(entry.options)
    await respond(records.slice().reverse())
    assert.deepEqual(contents(second.page), ['旧消息', '222'])
    records.push(message(3, '333'))
    second.socket.receive(records.at(-1))
    sendText(second.page, second.socket, '444')
    records.push(message(4, '444'))
    second.socket.receive(records.at(-1))
    const beforeLeaving = contents(second.page)
    assert.deepEqual(beforeLeaving, ['旧消息', '222', '333', '444'])
    second.page.onUnload()

    const third = enter(entry.options)
    await respond(records.slice().reverse())
    assert.deepEqual(contents(third.page), beforeLeaving)
    assert.equal(third.page.data.messages.at(-1).content, '444')
    assert.equal(third.page.data.scrollToView, 'msg-bottom')
    assert.equal(third.page.data.loading, false)
    assert.equal(third.page.data.hasMore, false)
  })

  test(entry.name + '：45 条同秒消息跨三页加载，期间的新消息仍在底部', async () => {
    const records = Array.from({ length: 45 }, (_, i) => message(i + 1))
    const { page, socket } = enter(entry.options)
    await respond(records.slice(25).reverse(), true)
    assert.deepEqual(ids(page), Array.from({ length: 20 }, (_, i) => i + 26))
    assert.equal(page.data.lastId, 26)

    page.onScrollToUpper()
    const olderRequest = historyRequests.at(-1)
    assert.equal(new URL(olderRequest.url).pathname, '/api/v1/chat/messages')
    assert.deepEqual(olderRequest.data, {
      conversationId: '10_20', size: 20, cursor: records[25].createdAt, lastId: 26
    })
    assert.equal(page.data.loadingMore, true)
    // 网络较慢时再次触顶不会并发加载；其间的新消息先经 WebSocket 到达。
    page.onScrollToUpper()
    assert.equal(historyRequests.length, 2)
    socket.receive(message(46, '最新消息'))
    await respond(records.slice(5, 25).reverse(), true)
    assert.deepEqual(ids(page), Array.from({ length: 41 }, (_, i) => i + 6))

    page.onScrollToUpper()
    assert.equal(historyRequests.at(-1).data.lastId, 6)
    await respond(records.slice(0, 5).reverse())
    assert.deepEqual(ids(page), Array.from({ length: 46 }, (_, i) => i + 1))
    assert.equal(new Set(ids(page)).size, 46)
    assert.equal(contents(page).at(-1), '最新消息')
    assert.equal(page.data.hasMore, false)
    assert.equal(page.data.loadingMore, false)
    page.onScrollToUpper()
    assert.equal(historyRequests.length, 3)
  })
}

test('重复 WebSocket 推送和其他会话的消息不会扰乱当前列表', async () => {
  const { page, socket } = enter()
  await respond([message(2), message(1)])
  socket.receive(message(2))
  socket.receive(message(3, '其他会话', { conversationId: '10_30' }))
  socket.receive(message(4, '新的消息'))
  socket.receive(message(4, '新的消息'))
  assert.deepEqual(ids(page), [1, 2, 4])
  assert.equal(contents(page).at(-1), '新的消息')
})

test('空会话发送第一条消息后，重新进入仍能显示该消息', async () => {
  const { page, socket } = enter()
  await respond([])
  assert.deepEqual(contents(page), [])
  assert.equal(page.data.loading, false)
  assert.equal(page.data.hasMore, false)
  sendText(page, socket, '第一条消息')
  const sent = message(2, '第一条消息')
  socket.receive(sent)
  page.onUnload()

  const reopened = enter()
  await respond([sent])
  assert.deepEqual(contents(reopened.page), ['第一条消息'])
})

test('文本、图片、帖子分享与撤回消息按历史顺序展示', async () => {
  const { page } = enter({ convId: '10_20' })
  const records = [
    message(1, '文字'),
    message(2, 'https://example.test/image.png', { msgType: 2 }),
    message(3, JSON.stringify({ postId: 100, title: '分享帖子' }), { msgType: 4 }),
    message(4, '', { msgType: 3 })
  ]
  await respond(records.slice().reverse())
  assert.deepEqual(ids(page), [1, 2, 3, 4])
  assert.deepEqual(page.data.messages.map(msg => msg.type), ['text', 'image', 'link', 'system'])
  assert.equal(contents(page).at(-1), '消息已撤回')
})
