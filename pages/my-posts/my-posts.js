const app = getApp()
const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    posts: [],
    cursor: null,
    hasMore: true,
    loading: false,
    refreshing: false
  },

  onLoad() {
    this.loadMyPosts()
  },

  /* 从 API 加载我的帖子：GET /api/post/my（游标分页，与 profile.js 一致）*/
  loadMyPosts(cursor) {
    if (this.data.loading) return Promise.resolve()
    this.setData({ loading: true })
    const data = { pageSize: 20 }
    if (cursor) data.cursor = cursor

    return request({ url: '/api/post/my', data })
      .then(result => {
        const likedIds = wx.getStorageSync('likedPostIds') || {}
        const list = (result.list || []).map(vo => this._mapPostVO(vo, likedIds))
        const posts = cursor
          ? [...this.data.posts, ...list]
          : list
        this.setData({
          posts,
          cursor: result.nextCursor || null,
          hasMore: result.hasMore || false,
          loading: false
        })
      })
      .catch(err => {
        console.error('加载我的帖子失败:', err)
        this.setData({ loading: false })
        if (!cursor) {
          wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none', duration: 2000 })
        }
      })
  },

  /* 将 PostListVO 映射为前端卡片格式 */
  _mapPostVO(vo, likedIds) {
    let timeStr = ''
    if (vo.createdAt) {
      if (Array.isArray(vo.createdAt)) {
        const [y, m, d, h, mi] = vo.createdAt
        timeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
      } else if (typeof vo.createdAt === 'string') {
        timeStr = vo.createdAt.replace('T', ' ').slice(0, 16)
      }
    }
    const statusMap = { 1: 'available', 2: 'taken', 3: 'taken' }
    return {
      id: vo.id,
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || ''
      },
      title: vo.title || '',
      content: vo.content || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      liked: vo.liked || !!likedIds[vo.id],
      time: timeStr,
      school: vo.schoolName || '',
      sourceType: vo.sourceType || null,
      sourceId: vo.sourceId || null,
      itemStatus: vo.status !== undefined ? (statusMap[vo.status] || '') : ''
    }
  },

  /* 下拉刷新 */
  onRefresh() {
    this.setData({ refreshing: true, cursor: null, hasMore: true, loading: false })
    this.loadMyPosts().finally(() => {
      this.setData({ refreshing: false })
    })
  },

  /* 上拉加载更多 */
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.loadMyPosts(this.data.cursor)
  },

  /* 显示操作菜单（编辑/删除） */
  onShowActionSheet(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.onEdit(id)
        } else if (res.tapIndex === 1) {
          this.onDelete(id)
        }
      }
    })
  },

  onEdit(id) {
    safeNavigate({ url: '/pages/publish-post/publish-post?editId=' + id })
  },

  onDelete(id) {
    wx.showModal({
      title: '提示',
      content: '确定要删除这条帖子吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          request({ url: '/api/post/' + id, method: 'DELETE' })
            .then(() => {
              wx.hideLoading()
              const posts = this.data.posts.filter(item => String(item.id) !== String(id))
              this.setData({ posts })
              wx.showToast({ title: '已删除', icon: 'success' })
            })
            .catch(err => {
              wx.hideLoading()
              console.error('删除帖子失败:', err)
              wx.showToast({ title: (err && err.message) || '删除失败，请重试', icon: 'none' })
            })
        }
      }
    })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    // 将当前帖子状态传递给详情页
    const post = this.data.posts.find(item => String(item.id) === String(id))
    if (post) {
      wx.setStorageSync('selectedPostDetail', post)
    }
    safeNavigate({ url: '/pages/post-detail/post-detail?id=' + id })
  }
})
