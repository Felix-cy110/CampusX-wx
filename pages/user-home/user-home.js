const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')
const { requestPostLikeChange, reconcileLikeCount } = require('../../utils/like')
const {
  applyFollowSnapshot,
  getFollowVersion,
  getKnownFollowStatus,
  refreshFollowStatus,
  requestFollowChange
} = require('../../utils/follow')

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
    followPending: false,
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
      this.refreshFollowStatus()
    }
  },

  refreshFollowStatus() {
    const userId = this.data.userId
    if (!userId || this.data.isOwnProfile) return
    refreshFollowStatus(userId).then(data => {
      if (data.stale) return
      this.setData({
        isFollowed: data.followedByMe,
        'stats.followers': data.followerCount,
        'stats.following': data.followingCount
      })
    }).catch(err => {
      console.error('刷新关注状态失败:', err)
    })
  },

  /* ===== 获取用户公开资料 ===== */
  fetchUserProfile(userId) {
    const followVersion = getFollowVersion(userId)
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
      const followedByMe = !!vo.followedByMe
      const accepted = applyFollowSnapshot(userId, followVersion, followedByMe)
      if (!accepted) {
        stats.followers = this.data.stats.followers
      }
      this.setData({
        userInfo,
        stats,
        isFollowed: accepted
          ? followedByMe
          : getKnownFollowStatus(userId, this.data.isFollowed)
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
    if (!userId || this.data.followPending) return
    const operation = requestFollowChange(userId, isFollowed)
    if (!operation) return

    this.setData({ followPending: true })
    operation.then(confirmedFollowed => {
      const followerCount = Math.max(0,
        (Number(this.data.stats.followers) || 0) +
        (confirmedFollowed ? 1 : 0) - (isFollowed ? 1 : 0))
      this.setData({
        isFollowed: confirmedFollowed,
        'stats.followers': followerCount
      })
      wx.showToast({ title: confirmedFollowed ? '已关注' : '已取消关注', icon: 'none' })
      this.refreshFollowStatus()
    }).catch(err => {
      console.error('关注操作失败:', err)
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none' })
    }).finally(() => {
      this.setData({ followPending: false })
    })
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
    const oldLikes = Number(item.stats.likes) || 0
    const newLiked = !isLiked
    const newLikes = reconcileLikeCount(isLiked, oldLikes, newLiked)
    const operation = requestPostLikeChange(id, isLiked)
    if (!operation) return

    const applyState = (liked, likes) => {
      const latestIndex = this.data.posts.findIndex(post => String(post.id) === String(id))
      if (latestIndex < 0) return
      this.setData({
        ['posts[' + latestIndex + '].liked']: liked,
        ['posts[' + latestIndex + '].stats.likes']: likes
      })
    }

    // 乐观更新
    applyState(newLiked, newLikes)

    operation.then(confirmedLiked => {
      const confirmedLikes = reconcileLikeCount(isLiked, oldLikes, confirmedLiked)
      applyState(confirmedLiked, confirmedLikes)
      // 同步点赞状态，供其他页面读取
      wx.setStorageSync('postLikeUpdate', { id, liked: confirmedLiked, likeCount: confirmedLikes })
    }).catch(err => {
      console.error('点赞操作失败:', err)
      // 回滚
      applyState(isLiked, oldLikes)
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
