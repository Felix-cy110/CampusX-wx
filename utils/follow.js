const { request } = require('./request')

let stateEpoch = 0
let followEntries = Object.create(null)

function normalizeUserId(userId) {
  if (userId === undefined || userId === null) return ''
  return String(userId).trim()
}

function getEntry(userId) {
  const key = normalizeUserId(userId)
  if (!key) return null
  if (!followEntries[key]) {
    followEntries[key] = {
      version: 0,
      hasValue: false,
      followed: false,
      mutation: null,
      refresh: null
    }
  }
  return followEntries[key]
}

function getFollowVersion(userId) {
  const entry = getEntry(userId)
  return entry ? entry.version : 0
}

function getKnownFollowStatus(userId, fallback) {
  const entry = getEntry(userId)
  return entry && entry.hasValue ? entry.followed : !!fallback
}

function hasKnownFollowStatus(userId) {
  const entry = getEntry(userId)
  return !!(entry && entry.hasValue)
}

/**
 * 接受详情接口内携带的关注快照。若快照发出后发生过关注操作，则拒绝旧快照。
 */
function applyFollowSnapshot(userId, version, followed) {
  const entry = getEntry(userId)
  if (!entry || entry.version !== version || entry.mutation) return false
  entry.hasValue = true
  entry.followed = !!followed
  return true
}

function normalizeFollowCount(data) {
  const source = data || {}
  return {
    followedByMe: !!source.followedByMe,
    followerCount: Math.max(0, Number(source.followerCount) || 0),
    followingCount: Math.max(0, Number(source.followingCount) || 0)
  }
}

/**
 * 查询权威关注状态。同一用户的并发查询会合并；关注操作开始后，旧查询结果会标记为 stale。
 */
function refreshFollowStatus(userId) {
  const key = normalizeUserId(userId)
  const entry = getEntry(key)
  if (!entry) return Promise.reject(new Error('缺少被关注用户 ID'))

  if (entry.mutation) {
    return entry.mutation.then(
      () => refreshFollowStatus(key),
      () => refreshFollowStatus(key)
    )
  }

  const startedAtVersion = entry.version
  if (entry.refresh && entry.refresh.version === startedAtVersion) {
    return entry.refresh.promise
  }

  const startedAtEpoch = stateEpoch
  let trackedPromise
  const networkPromise = request({
    url: '/api/v1/follow/count/' + key,
    method: 'GET'
  }).then(data => {
    const status = normalizeFollowCount(data)
    const current = getEntry(key)
    const stale = startedAtEpoch !== stateEpoch ||
      !current || current.version !== startedAtVersion || !!current.mutation

    if (!stale) {
      current.hasValue = true
      current.followed = status.followedByMe
    }
    return { ...status, stale }
  })

  trackedPromise = networkPromise.finally(() => {
    const current = getEntry(key)
    if (current && current.refresh && current.refresh.promise === trackedPromise) {
      current.refresh = null
    }
  })
  entry.refresh = { version: startedAtVersion, promise: trackedPromise }
  return trackedPromise
}

/**
 * 按目标用户加锁执行关注/取关。返回 null 表示该用户已有操作在途，本次点击被忽略。
 */
function requestFollowChange(userId, currentlyFollowed) {
  const key = normalizeUserId(userId)
  const entry = getEntry(key)
  if (!entry) return null
  if (entry.mutation) return null

  const targetFollowed = !currentlyFollowed
  const startedAtEpoch = stateEpoch
  entry.version += 1

  let trackedPromise
  const networkPromise = request({
    url: '/api/v1/follow/' + key,
    method: targetFollowed ? 'POST' : 'DELETE'
  }).then(() => {
    if (startedAtEpoch === stateEpoch) {
      const current = getEntry(key)
      current.version += 1
      current.hasValue = true
      current.followed = targetFollowed
    }
    return targetFollowed
  }, error => {
    // 写请求超时或重复操作报错时，服务端可能已经处于目标状态；回读一次再决定是否失败。
    return request({
      url: '/api/v1/follow/count/' + key,
      method: 'GET'
    }).then(data => {
      if (startedAtEpoch !== stateEpoch) throw error
      const status = normalizeFollowCount(data)
      const current = getEntry(key)
      current.version += 1
      current.hasValue = true
      current.followed = status.followedByMe
      if (status.followedByMe === targetFollowed) return targetFollowed
      throw error
    }, () => {
      if (startedAtEpoch === stateEpoch) getEntry(key).version += 1
      throw error
    })
  })

  trackedPromise = networkPromise.finally(() => {
    if (startedAtEpoch !== stateEpoch) return
    const current = getEntry(key)
    if (current && current.mutation === trackedPromise) current.mutation = null
  })
  entry.mutation = trackedPromise
  return trackedPromise
}

function resetFollowState() {
  stateEpoch += 1
  followEntries = Object.create(null)
}

module.exports = {
  applyFollowSnapshot,
  getFollowVersion,
  getKnownFollowStatus,
  hasKnownFollowStatus,
  refreshFollowStatus,
  requestFollowChange,
  resetFollowState
}
