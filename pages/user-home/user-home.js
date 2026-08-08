const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    userId: '',
    isOwnProfile: false,
    userInfo: {
      userId: '',
      nickname: '',
      avatar: '',
      campusName: '',
      departmentName: '',
      majorName: '',
      enrollmentYear: ''
    },
    stats: {
      postCount: 0,
      following: 0,
      followers: 0,
      likes: 0
    },
    isFollowed: false,
    posts: [],
    postsCursor: null,
    postsHasMore: true,
    postsLoading: false,
    loadingMore: false,

    /* 自定义导航栏尺寸 */
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    const userId = options.userId || ''
    const currentUid = (app.globalData.userInfo || {}).uid
    const isOwnProfile = userId && String(userId) === String(currentUid)

    // 从 URL 参数预填信息
    const initialUserInfo = {
      userId: userId,
      nickname: decodeURIComponent(options.name || ''),
      avatar: decodeURIComponent(options.avatar || '')
    }

    this.setData({
      userId,
      isOwnProfile,
      statusBarHeight,
      navBarHeight,
      userInfo: { ...this.data.userInfo, ...initialUserInfo }
    })

    if (userId) {
      this.fetchUserProfile(userId)
      this.loadPosts()
    }
    this._initialized = false
  },

  onShow() {
    // 首次加载跳过（由 fetchUserProfile 负责初始化 isFollowed），仅后续返回时刷新
    if (!this._initialized) {
      this._initialized = true
      return
    }
    // 同步详情页的点赞/取消赞操作到列表
    this._syncPostLikeUpdate()
    // 从其他页面返回时刷新关注状态和粉丝数
    if (this.data.userId && !this.data.isOwnProfile) {
      request({
        url: '/api/v1/follow/count/' + this.data.userId,
        method: 'GET'
      }).then(data => {
        const stats = this.data.stats
        this.setData({
          isFollowed: data.followedByMe || false,
          stats: {
            ...stats,
            followers: data.followerCount || 0,
            following: data.followingCount || 0
          }
        })
      }).catch(() => {})
    }
  },

  /* ===== 获取用户公开资料 ===== */
  fetchUserProfile(userId) {
    request({
      url: '/api/v1/user/profile/' + userId,
      method: 'GET'
    }).then(vo => {
      const userInfo = {
        userId: String(vo.userId),
        nickname: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '',
        campusName: vo.campusName || '',
        departmentName: vo.departmentName || '',
        majorName: vo.majorName || '',
        enrollmentYear: vo.enrollmentYear || ''
      }
      const stats = {
        postCount: vo.postCount || 0,
        following: vo.followingCount || 0,
        followers: vo.followerCount || 0,
        likes: vo.likedCount || 0
      }
      this.setData({
        userInfo,
        stats,
        isFollowed: vo.followedByMe || false
      })
    }).catch(err => {
      console.error('获取用户资料失败:', err)
      wx.showToast({ title: '获取用户资料失败', icon: 'none' })
    })
  },

  /* ===== 加载帖子列表 ===== */
  loadPosts() {
    if (this.data.postsLoading) return
    this.setData({ postsLoading: true, posts: [], postsCursor: null, postsHasMore: true })
    this._fetchPosts()
  },

  loadMorePosts() {
    if (!this.data.postsHasMore || this.data.loadingMore || this.data.postsLoading) return
    this.setData({ loadingMore: true })
    this._fetchPosts(true)
  },

  _fetchPosts(isLoadMore) {
    const data = { pageSize: 20 }
    if (isLoadMore && this.data.postsCursor) {
      data.cursor = this.data.postsCursor
    }
    request({
      url: '/api/post/user/' + this.data.userId,
      data
    }).then(result => {
      const list = (result.list || []).map(vo => this._mapPostToCard(vo))
      const nextCursor = result.nextCursor || null
      const hasMore = result.hasMore || false
      const posts = isLoadMore ? this.data.posts.concat(list) : list
      this.setData({
        posts,
        postsCursor: nextCursor,
        postsHasMore: hasMore,
        postsLoading: false,
        loadingMore: false
      })
    }).catch(err => {
      console.error('获取用户帖子失败:', err)
      this.setData({ postsLoading: false, loadingMore: false })
    })
  },

  /* ===== 数据映射：PostListVO → 前端卡片 ===== */
  _mapPostToCard(vo) {
    const userInfo = this.data.userInfo || {}
    return {
      id: String(vo.id),
      type: 'posts',
      user: {
        uid: String(vo.userId),
        name: vo.nickname || userInfo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || userInfo.avatar || ''
      },
      time: this._formatRelativeTime(vo.createdAt),
      content: vo.title || vo.content || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      liked: vo.liked || false
    }
  },

  /* ===== 时间格式化 ===== */
  _formatRelativeTime(dateStr) {
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
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  },

  /* ===== 关注/取关 ===== */
  toggleFollow() {
    const userId = this.data.userId
    const isFollowed = this.data.isFollowed
    if (isFollowed) {
      request({
        url: '/api/v1/follow/' + userId,
        method: 'DELETE'
      }).then(() => {
        this.setData({ isFollowed: false })
        const stats = this.data.stats
        stats.followers = Math.max(0, stats.followers - 1)
        this.setData({ stats })
        wx.showToast({ title: '已取消关注', icon: 'none' })
      }).catch(err => {
        console.error('取消关注失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      request({
        url: '/api/v1/follow/' + userId,
        method: 'POST'
      }).then(() => {
        this.setData({ isFollowed: true })
        const stats = this.data.stats
        stats.followers = stats.followers + 1
        this.setData({ stats })
        wx.showToast({ title: '已关注', icon: 'none' })
      }).catch(err => {
        console.error('关注失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    }
  },

  /* ===== 导航 ===== */
  goBack() {
    wx.navigateBack()
  },

  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.posts.find(item => String(item.id) === String(id))
    if (post) {
      wx.setStorageSync('selectedPostDetail', post)
      safeNavigate({ url: '/pages/post-detail/post-detail?id=' + id })
    }
  },

  goToChat() {
    const { userInfo } = this.data
    safeNavigate({
      url: `/pages/chat/chat?userId=${userInfo.userId || ''}&name=${encodeURIComponent(userInfo.nickname)}&avatar=${encodeURIComponent(userInfo.avatar)}`
    })
  },

  /* 列表点赞/取消赞（乐观更新） */
  toggleFeedLike(e) {
    const { id, index } = e.currentTarget.dataset
    const dataList = this.data.posts
    if (!dataList || index === undefined || index >= dataList.length) return
    const item = dataList[index]
    if (String(item.id) !== String(id)) return

    const isLiked = item.liked
    const newLiked = !isLiked
    const newLikes = Math.max(0, (item.stats.likes || 0) + (newLiked ? 1 : -1))
    const apiUrl = isLiked ? '/api/post/unlike/' + id : '/api/post/like/' + id

    // 乐观更新
    this.setData({
      ['posts[' + index + '].liked']: newLiked,
      ['posts[' + index + '].stats.likes']: newLikes
    })

    request({ url: apiUrl, method: 'POST' }).then(() => {
      // 同步点赞状态，供其他页面读取
      wx.setStorageSync('postLikeUpdate', { id: id, liked: newLiked, likeCount: newLikes })
    }).catch(err => {
      console.error('点赞操作失败:', err)
      // 回滚
      this.setData({
        ['posts[' + index + '].liked']: isLiked,
        ['posts[' + index + '].stats.likes']: item.stats.likes
      })
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  /* 同步详情页点赞操作到列表 */
  _syncPostLikeUpdate() {
    const update = wx.getStorageSync('postLikeUpdate')
    if (!update || !update.id) return
    wx.removeStorageSync('postLikeUpdate')

    const list = this.data.posts
    if (!list) return
    const idx = list.findIndex(item => String(item.id) === String(update.id))
    if (idx < 0) return
    this.setData({
      ['posts[' + idx + '].liked']: update.liked,
      ['posts[' + idx + '].stats.likes']: update.likeCount
    })
  }
})
