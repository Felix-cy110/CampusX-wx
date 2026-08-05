const { request } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,

    teacherId: '',
    teacherName: '',
    courseId: '',
    courseName: '',
    avgScore: '',
    courseAvgScore: '',
    ratingCount: 0,

    ratings: [],
    cursor: null,
    hasMore: true,
    loading: false,
    loadingMore: false,

    starArray: [1, 2, 3, 4, 5]
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })

    const teacherId = options.teacherId || ''
    const teacherName = decodeURIComponent(options.teacherName || '')
    const courseId = options.courseId || ''
    const courseName = decodeURIComponent(options.courseName || '')
    const avgScore = decodeURIComponent(options.avgScore || options.teacherAvgScore || '')
    const courseAvgScore = decodeURIComponent(options.courseAvgScore || '')
    const ratingCount = parseInt(options.ratingCount) || 0

    this.setData({
      teacherId, teacherName,
      courseId, courseName,
      avgScore, courseAvgScore,
      ratingCount
    })

    if (teacherId) {
      this.loadRatings()
    }
  },

  goBack() {
    wx.navigateBack()
  },

  /** 去提交评分：携带当前教师和课程信息，直接进入评分表单 */
  goPublishRating() {
    const { teacherId, teacherName, avgScore, ratingCount, courseId, courseName, courseAvgScore } = this.data
    const params = [
      `teacherId=${teacherId}`,
      `teacherName=${encodeURIComponent(teacherName)}`,
      `teacherAvgScore=${encodeURIComponent(avgScore || '')}`,
      `teacherRatingCount=${ratingCount}`,
      `courseId=${courseId}`,
      `courseName=${encodeURIComponent(courseName)}`,
      `courseAvgScore=${encodeURIComponent(courseAvgScore || '')}`
    ].join('&')
    wx.navigateTo({ url: `/pages/publish-rating/publish-rating?${params}` })
  },

  /** 匿名化用户信息 */
  anonymizeUser(nickname, avatarUrl) {
    const name = (nickname && nickname.length > 0) ? nickname[0] + '***' : '匿***'
    return {
      name: name,
      avatar: '/images/SVG/匿名用户.svg'
    }
  },

  /** 加载评分列表（游标分页） */
  loadRatings() {
    if (this.data.loading || !this.data.hasMore) return

    this.setData({ loading: true, loadingMore: this.data.ratings.length > 0 })

    const params = {
      pageSize: 20
    }
    if (this.data.cursor) {
      params.cursor = this.data.cursor
    }
    // 如果有 courseId，传给后端筛选
    if (this.data.courseId) {
      params.courseId = this.data.courseId
    }

    request({
      url: `/api/v1/teacher/${this.data.teacherId}/ratings`,
      method: 'GET',
      data: params
    }).then(data => {
      const newList = (data && data.list) ? data.list : []
      const nextCursor = (data && data.nextCursor != null) ? data.nextCursor : null

      // 如果有 courseName，客户端侧做一次过滤
      let filtered = newList
      if (this.data.courseName) {
        filtered = newList.filter(r => r.courseName === this.data.courseName || r.courseName === '综合')
      }

      const ratings = this.data.ratings.concat(filtered.map(r => {
        const anonymized = this.anonymizeUser(r.nickname, r.avatarUrl)
        return {
          id: r.id,
          courseName: r.courseName || '综合',
          score: r.score,
          content: r.content || '',
          tags: r.tags || [],
          createdAt: this.formatTime(r.createdAt),
          user: anonymized
        }
      }))

      this.setData({
        ratings,
        ratingCount: ratings.length,
        cursor: nextCursor,
        hasMore: nextCursor != null && filtered.length > 0,
        loading: false,
        loadingMore: false
      })
    }).catch(err => {
      console.error('加载评分失败:', err)
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    })
  },

  /** 加载更多 */
  loadMore() {
    this.loadRatings()
  },

  /** 格式化时间 */
  formatTime(timeStr) {
    if (!timeStr) return ''
    if (Array.isArray(timeStr)) {
      const [y, m, d, h, mi] = timeStr
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
    }
    if (typeof timeStr === 'string') {
      return timeStr.replace('T', ' ').slice(0, 16)
    }
    return timeStr
  },

  /** 刷新 */
  refreshRatings() {
    this.setData({ ratings: [], cursor: null, hasMore: true })
    this.loadRatings()
  }
})
