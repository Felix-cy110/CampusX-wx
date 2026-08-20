const { request } = require('./request')

const COUNT_KEYS = ['likes', 'followers', 'comments', 'system', 'chatUnread']
const NOTIFICATION_TYPES = {
  likes: true,
  followers: true,
  comments: true,
  system: true
}

let refreshInFlight = null
let stateEpoch = 0
let mutationVersion = 0
let pendingMutationCount = 0
let refreshQueued = false
let pendingMutations = Object.create(null)

function normalizeCounts(source) {
  const input = source || {}
  const counts = {}
  COUNT_KEYS.forEach(key => {
    const value = Number(input[key])
    counts[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  })
  return counts
}

function getGlobalData() {
  const app = getApp()
  return app && app.globalData ? app.globalData : null
}

function getUnreadCounts() {
  const globalData = getGlobalData()
  return normalizeCounts(globalData && globalData.notificationCounts)
}

function publishCounts(source) {
  const counts = normalizeCounts(source)
  const globalData = getGlobalData()
  if (!globalData) return counts

  globalData.notificationCounts = counts
  globalData._notificationCountsLoaded = true

  const tabBar = globalData._tabBar
  if (tabBar && typeof tabBar.updateBadgeFromGlobalData === 'function') {
    tabBar.updateBadgeFromGlobalData()
  }
  return counts
}

function finishRefresh(promise, result, error) {
  if (refreshInFlight === promise) {
    refreshInFlight = null
  }

  if (pendingMutationCount === 0 && refreshQueued) {
    refreshQueued = false
    return refreshUnreadCounts()
  }

  if (error) throw error
  return result
}

/**
 * 获取权威未读数。同一时刻只允许一个 count 请求在途；如果请求期间发生本地已读操作，
 * 该响应会被丢弃，并在所有已读操作结束后重新请求。
 */
function refreshUnreadCounts() {
  if (pendingMutationCount > 0) {
    refreshQueued = true
    return Promise.resolve(getUnreadCounts())
  }
  if (refreshInFlight) return refreshInFlight

  const startedAtVersion = mutationVersion
  const startedAtEpoch = stateEpoch
  let trackedPromise
  const networkPromise = request({ url: '/api/v1/notification/count' }).then(data => {
    if (startedAtEpoch !== stateEpoch) return getUnreadCounts()
    if (startedAtVersion !== mutationVersion) {
      refreshQueued = true
      return getUnreadCounts()
    }
    return publishCounts(data)
  })

  trackedPromise = networkPromise.then(
    result => finishRefresh(trackedPromise, result, null),
    error => finishRefresh(trackedPromise, null, error)
  )
  refreshInFlight = trackedPromise
  return trackedPromise
}

function runMutation(key, optimisticUpdate, requestOptions) {
  if (pendingMutations[key]) return pendingMutations[key]

  mutationVersion += 1
  pendingMutationCount += 1
  const startedAtEpoch = stateEpoch
  publishCounts(optimisticUpdate(getUnreadCounts()))

  let trackedPromise
  const networkPromise = request(requestOptions)
  trackedPromise = networkPromise.then(
    data => settleMutation(key, trackedPromise, startedAtEpoch, data, null),
    error => settleMutation(key, trackedPromise, startedAtEpoch, null, error)
  )
  pendingMutations[key] = trackedPromise
  return trackedPromise
}

function settleMutation(key, promise, startedAtEpoch, data, error) {
  if (startedAtEpoch !== stateEpoch) {
    if (error) throw error
    return { data, counts: getUnreadCounts() }
  }
  if (pendingMutations[key] === promise) {
    delete pendingMutations[key]
  }
  pendingMutationCount = Math.max(0, pendingMutationCount - 1)
  mutationVersion += 1

  if (pendingMutationCount > 0) {
    refreshQueued = true
    if (error) throw error
    return { data, counts: getUnreadCounts() }
  }

  // 成功和失败都重新读取服务端：成功用于确认最终结果，失败用于撤销乐观状态。
  refreshQueued = false
  return refreshUnreadCounts().catch(() => getUnreadCounts()).then(counts => {
    if (error) throw error
    return { data, counts }
  })
}

function markNotificationRead(type, readThrough) {
  if (!NOTIFICATION_TYPES[type]) {
    return Promise.reject(new Error('不支持的通知类型: ' + type))
  }
  const options = {
    url: '/api/v1/notification/read/' + type,
    method: 'POST'
  }
  if (readThrough) {
    options.data = { readThrough }
  }
  return runMutation('notification:' + type, counts => {
    counts[type] = 0
    return counts
  }, options)
}

function markChatConversationRead(options) {
  const input = options || {}
  if (!input.otherUserId) return Promise.resolve({ counts: getUnreadCounts() })

  const unreadCount = Math.max(0, parseInt(input.unreadCount, 10) || 0)
  const orderId = input.orderId || null
  const keySuffix = input.mutationKey ? ':' + input.mutationKey : ''
  const key = 'chat:' + input.otherUserId + ':' + (orderId || '') + keySuffix
  return runMutation(key, counts => {
    counts.chatUnread = Math.max(0, counts.chatUnread - unreadCount)
    return counts
  }, {
    url: '/api/v1/chat/read',
    method: 'POST',
    data: { otherUserId: input.otherUserId, orderId }
  })
}

function resetUnreadState() {
  refreshInFlight = null
  stateEpoch += 1
  mutationVersion += 1
  pendingMutationCount = 0
  refreshQueued = false
  pendingMutations = Object.create(null)
}

module.exports = {
  getUnreadCounts,
  markChatConversationRead,
  markNotificationRead,
  normalizeCounts,
  refreshUnreadCounts,
  resetUnreadState
}
