const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')
const { markNotificationRead } = require('../../utils/unread')

Page({
  data: {
    likedList: [],
    loading: false,
    hasMore: true,
    nextCursor: null,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })
    this.loadLikes()
  },

  loadLikes() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })

    const params = { size: 20 }
    if (this.data.nextCursor) {
      params.cursor = this.data.nextCursor
    }

    const isFirstPage = !this.data.nextCursor
    return request({ url: '/api/v1/notification/likes', data: params }).then(data => {
      const rawList = data.list || []
      const list = rawList.map(mapLikeItem)
      const likedList = this.data.nextCursor
        ? this.data.likedList.concat(list)
        : list
      this.setData({
        likedList,
        loading: false,
        hasMore: data.hasMore !== undefined ? data.hasMore : list.length >= 20,
        nextCursor: data.nextCursor || null
      })
      if (isFirstPage) {
        const readThrough = rawList.length > 0 ? rawList[0].createdAt : null
        if (readThrough) this.markLikesRead(readThrough)
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  /** 滚动到底部加载更多 */
  onScrollToLower() {
    this.loadLikes()
  },

  onItemTap(e) {
    const { postId } = e.currentTarget.dataset
    if (postId) {
      safeNavigate({ url: `/pages/post-detail/post-detail?id=${postId}` })
    }
  },

  navigateBack() {
    wx.navigateBack()
  },

  /** 标记点赞通知为已读，并立即刷新 tabBar badge */
  markLikesRead(readThrough) {
    markNotificationRead('likes', readThrough).catch(err => {
      console.error('标记点赞通知已读失败:', err)
    })
  }
})

function mapLikeItem(item) {
  return {
    cursorId: item.cursorId,
    userId: item.userId || '',
    avatar: toFullUrl(item.avatarUrl || ''),
    name: item.nickname || '',
    postId: item.postId,
    postTitle: item.postTitle || '',
    time: formatRelativeTime(item.createdAt)
  }
}

/** 时间格式化：相对时间 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  let date
  if (Array.isArray(dateStr)) {
    date = new Date(dateStr[0], dateStr[1] - 1, dateStr[2],
      dateStr[3] || 0, dateStr[4] || 0, dateStr[5] || 0)
  } else {
    date = new Date(String(dateStr).replace('T', ' ').replace(/-/g, '/'))
  }
  if (isNaN(date.getTime())) return ''
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + '分钟前'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + '小时前'
  const days = Math.floor(hours / 24)
  if (days < 30) return days + '天前'
  const months = Math.floor(days / 30)
  if (months < 12) return months + '个月前'
  return Math.floor(months / 12) + '年前'
}
