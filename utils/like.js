const { request } = require('./request')

// 同一个小程序进程内，同一目标只允许一个点赞状态变更请求在途，避免快速连点导致请求乱序。
const pendingLikes = Object.create(null)

function requestLikeChange(type, id, currentlyLiked) {
  const key = type + ':' + String(id)
  if (pendingLikes[key]) return null

  const basePath = type === 'comment' ? '/api/post/comment/' : '/api/post/'
  const action = currentlyLiked ? 'unlike/' : 'like/'
  pendingLikes[key] = true

  return request({
    url: basePath + action + id,
    method: 'POST'
  }).then(liked => liked === true).finally(() => {
    delete pendingLikes[key]
  })
}

function requestPostLikeChange(id, currentlyLiked) {
  return requestLikeChange('post', id, currentlyLiked)
}

function requestCommentLikeChange(id, currentlyLiked) {
  return requestLikeChange('comment', id, currentlyLiked)
}

/**
 * 以操作前的服务端计数为基准，用接口返回的最终 liked 状态校正计数。
 */
function reconcileLikeCount(previousLiked, previousCount, confirmedLiked) {
  const count = Number(previousCount) || 0
  return Math.max(0, count + (confirmedLiked ? 1 : 0) - (previousLiked ? 1 : 0))
}

module.exports = {
  requestPostLikeChange,
  requestCommentLikeChange,
  reconcileLikeCount
}
