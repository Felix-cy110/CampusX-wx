/**
 * 抽奖/邀请有奖 API 封装
 */
const { request } = require('../request')

/**
 * 获取活动列表（用户端，游标分页）
 * @param {number|null} cursor - 游标（上一页最后一条的 id），首次传 null
 * @param {number} size - 每页条数，默认 20
 * @returns {Promise<{list: Array, nextCursor: number|null, hasMore: boolean}>}
 */
function getActivities(cursor, size) {
  const data = {}
  if (cursor != null) data.cursor = cursor
  if (size != null) data.size = size
  return request({
    url: '/api/v1/lottery/activities',
    method: 'GET',
    data
  }).then(res => ({
    list: (res.list || []).map(mapActivity),
    nextCursor: res.nextCursor || null,
    hasMore: res.hasMore !== false
  }))
}

/**
 * 获取活动详情（用户端）
 * @param {number} id - 活动 ID
 * @returns {Promise<Object>}
 */
function getActivityDetail(id) {
  return request({
    url: '/api/v1/lottery/activities/' + id,
    method: 'GET'
  }).then(mapActivity)
}

/**
 * 获取当前用户在指定活动中的抽奖号码
 * @param {number} [activityId] - 活动 ID，不传则查全部
 * @returns {Promise<Array>}
 */
function getMyTickets(activityId) {
  const data = {}
  if (activityId != null) data.activityId = activityId
  return request({
    url: '/api/v1/lottery/tickets',
    method: 'GET',
    data
  }).then(list => (list || []).map(mapTicket))
}

/**
 * 来源类型 → 中文标签
 */
const SOURCE_LABEL = { 1: '付费发帖', 2: '交易达标', 3: '邀请奖励' }

function mapActivity(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || '',
    coverImage: raw.coverImage || '',
    startTime: raw.startTime || '',
    endTime: raw.endTime || '',
    status: raw.status,
    prizes: (raw.prizes || []).map(p => ({
      id: p.id,
      level: p.level || '',
      description: p.description || '',
      sort: p.sort,
      quantity: p.quantity,
      winningCodes: p.winningCodes || [],
      winnerUserIds: p.winnerUserIds || []
    }))
  }
}

function mapTicket(raw) {
  return {
    id: raw.id,
    code: raw.code || '',
    source: raw.source,
    sourceLabel: SOURCE_LABEL[raw.source] || '',
    createdAt: raw.createdAt || ''
  }
}

module.exports = { getActivities, getActivityDetail, getMyTickets }
