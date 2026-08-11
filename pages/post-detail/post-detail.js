const app = getApp()
const mock = require('../../utils/mock.js')
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    post: {},
    comments: [],
    flatComments: [],
    groupedComments: [],
    postId: '',
    swiperCurrent: 0,
    statusBarHeight: 0,
    navBarHeight: 0,
    showActionSheet: false,
    showShareModal: false,
    showCommentOptionsModal: false,
    selectedComment: null,
    commentIsOwn: false,
    commentInput: '',
    currentUserAvatar: '',
    replyTarget: null,
    commentCursor: null,
    commentHasMore: true,
    commentLoading: false,
    /* 举报弹窗 */
    showReportModal: false,
    reportReasons: [
      { code: 1, desc: '违规内容' },
      { code: 2, desc: '垃圾广告' },
      { code: 3, desc: '诈骗欺诈' },
      { code: 4, desc: '色情低俗' },
      { code: 5, desc: '侵权抄袭' },
      { code: 6, desc: '其他' }
    ],
    reportTargetType: 1,
    reportTargetId: '',
    reportSelectedReason: 0,
    reportRemark: '',
    reportSubmitting: false
  },
  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    const rawId = options.id || ''
    const numericId = Number(rawId)
    const cachedPost = wx.getStorageSync('selectedPostDetail')
    const postSource = this.findMockPost(rawId, numericId) ||
      (cachedPost && String(cachedPost.id) === String(rawId) ? cachedPost : null)

    // 当前用户发布的帖子，头像昵称跟随全局数据
    const userInfo = app.globalData.userInfo || {}
    const currentUserAvatar = userInfo.avatar || '/images/avatars/default.png'

    if (postSource) {
      const post = this.normalizePost(postSource)
      if (post.user && post.user.uid === userInfo.uid) {
        post.user = {
          ...post.user,
          name: userInfo.nickname || post.user.name,
          avatar: userInfo.avatar || post.user.avatar
        }
      }
      post.isOwn = post.isOwn || (post.user && post.user.uid === userInfo.uid)
      post.liked = post.liked ?? false
      post.isFollowed = post.isFollowed ?? false
      post.favorited = post.favorited ?? false
      post.school = post.school || '南京信息工程大学'
      post.displayContent = post.fullContent || post.content
      this.setData({
        post,
        postId: rawId,
        currentUserAvatar,
        statusBarHeight,
        navBarHeight
      })
    } else {
      this.setData({
        post: { id: rawId, user: {}, stats: {}, images: [] },
        postId: rawId,
        currentUserAvatar,
        statusBarHeight,
        navBarHeight
      })
    }
    this.loadPostDetail(rawId)
    this.loadComments(rawId)
  },
  loadPostDetail(id) {
    if (!id) return
    const userInfo = app.globalData.userInfo || {}
    request({ url: '/api/post/' + id }).then(vo => {
      const post = {
        id: vo.id,
        user: { uid: vo.userId, name: vo.nickname, avatar: toFullUrl(vo.avatarUrl) },
        title: vo.title,
        content: vo.content,
        displayContent: vo.content,
        images: (vo.imageUrls || []).map(toFullUrl),
        stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0, favorites: vo.favoriteCount || 0 },
        liked: vo.liked || false,
        favorited: vo.favorited || false,
        isOwn: String(vo.userId) === String(userInfo.uid),
        isFollowed: vo.followedByMe || false,
        school: '',
        sourceType: vo.sourceType || '',
        sourceId: vo.sourceId || '',
        time: vo.createdAt ? vo.createdAt.replace('T', ' ').slice(0, 16) : ''
      }
      this.setData({ post })
    }).catch(() => {
      console.warn('加载帖子详情失败, postId:', id)
      if (!this.data.post || !this.data.post.title) {
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      }
    })
  },
  /* 二手商品关联帖：跳转商品详情购买 */
  goBuy() {
    const sourceId = this.data.post.sourceId
    if (!sourceId) {
      wx.showToast({ title: '商品信息不可用', icon: 'none' })
      return
    }
    safeNavigate({ url: '/pages/market-detail/market-detail?id=' + sourceId })
  },

  /* 跑腿关联帖：跳转跑腿详情下单 */
  goGrabErrand() {
    const post = this.data.post
    const sourceId = post.sourceId
    if (!sourceId) {
      wx.showToast({ title: '跑腿信息不可用', icon: 'none' })
      return
    }
    // 从帖子正文解析代课费（关联帖正文格式：【代课费】¥xx）
    const rewardMatch = (post.displayContent || '').match(/【代课费】¥([\d.]+)/)
    const demand = {
      id: sourceId,
      type: 'errand',
      title: (post.title || '').replace(/^【求代课】/, ''),
      content: post.displayContent || '',
      reward: rewardMatch ? Number(rewardMatch[1]) : 0,
      time: post.time || '',
      user: post.user || {},
      status: 'available',
      _raw: {}
    }
    wx.setStorageSync('currentErrand', demand)
    safeNavigate({ url: '/pages/errand-detail/errand-detail?id=' + sourceId })
  },

  /* 加载评论列表 */
  loadComments(postId) {
    if (!postId) return
    this.setData({ commentLoading: true })
    request({
      url: '/api/post/comments',
      data: { postId: Number(postId), pageSize: 20 }
    }).then(result => {
      const list = result.list || []
      console.log('[loadComments] API返回评论数:', list.length, 'list:', JSON.stringify(list).slice(0, 500))
      const comments = list.map(vo => this.mapCommentVO(vo))
      console.log('[loadComments] 映射后comments:', JSON.stringify(comments).slice(0, 1000))
      const flatComments = this.flattenComments(comments)
      const groupedComments = this.groupComments(flatComments, this.data.groupedComments)
      console.log('[loadComments] 扁平化后flatComments:', JSON.stringify(flatComments).slice(0, 1000))
      this.setData({
        comments,
        flatComments,
        groupedComments,
        commentCursor: result.nextCursor || null,
        commentHasMore: result.hasMore || false,
        commentLoading: false
      })
      // 同步更新帖子评论数
      const totalComments = this.countTotalComments(comments)
      const post = this.data.post
      if (post.stats) post.stats.comments = totalComments
      this.setData({ post })
    }).catch(err => {
      console.error('加载评论失败:', err)
      // fallback：使用本地 mock 评论数据
      const fallbackComments = mock.postComments || []
      console.log('[loadComments] 使用mock数据, 条数:', fallbackComments.length, '数据:', JSON.stringify(fallbackComments).slice(0, 500))
      const comments = fallbackComments.map(vo => this.mapCommentVO(vo))
      console.log('[loadComments] mock映射后comments:', JSON.stringify(comments).slice(0, 1000))
      const flatComments = this.flattenComments(comments)
      const groupedComments = this.groupComments(flatComments, this.data.groupedComments)
      this.setData({
        comments,
        flatComments,
        groupedComments,
        commentCursor: null,
        commentHasMore: false,
        commentLoading: false
      })
      const totalComments = this.countTotalComments(comments)
      const post = this.data.post
      if (post.stats) post.stats.comments = totalComments
      this.setData({ post })
    })
  },

  /* 加载更多评论 */
  loadMoreComments() {
    if (!this.data.commentHasMore || this.data.commentLoading) return
    const postId = Number(this.data.postId)
    if (!postId) return
    this.setData({ commentLoading: true })
    request({
      url: '/api/post/comments',
      data: { postId, cursor: this.data.commentCursor, pageSize: 20 }
    }).then(result => {
      const list = result.list || []
      const newComments = list.map(vo => this.mapCommentVO(vo))
      const comments = this.data.comments.concat(newComments)
      const flatComments = this.flattenComments(comments)
      const groupedComments = this.groupComments(flatComments, this.data.groupedComments)
      this.setData({
        comments,
        flatComments,
        groupedComments,
        commentCursor: result.nextCursor || null,
        commentHasMore: result.hasMore || false,
        commentLoading: false
      })
      // 同步更新帖子评论数
      const totalComments = this.countTotalComments(comments)
      const post = this.data.post
      if (post.stats) post.stats.comments = totalComments
      this.setData({ post })
    }).catch(err => {
      console.error('加载更多评论失败:', err)
      this.setData({ commentLoading: false })
    })
  },

  /* 递归统计评论总数（含所有层级子回复） */
  countTotalComments(comments) {
    let count = 0
    for (const c of comments) {
      count += 1
      if (c.replies && c.replies.length > 0) {
        count += this.countTotalComments(c.replies)
      }
    }
    return count
  },

  /* 将后端 PostCommentVO 转为前端展示格式 */
  mapCommentVO(vo, parentName) {
    const comment = {
      id: vo.id,
      userId: vo.userId,
      name: vo.nickname || '',
      avatar: toFullUrl(vo.avatarUrl) || '',
      time: this.formatRelativeTime(vo.createdAt),
      content: vo.content || '',
      likes: vo.likeCount || 0,
      liked: vo.liked || false,
      replies: [],
      depth: 0
    }
    if (parentName) {
      comment.replyTo = parentName
    }
    if (vo.replies && vo.replies.length > 0) {
      console.log('[mapCommentVO] 评论id=' + vo.id + ' 有' + vo.replies.length + '条回复, parentName=' + parentName)
      comment.replies = vo.replies.map(reply =>
        this.mapCommentVO(reply, vo.nickname)
      )
      console.log('[mapCommentVO] 映射后replies:', JSON.stringify(comment.replies).slice(0, 500))
    }
    // 递归计算总回复数（含所有层级）
    comment.totalReplies = this.countTotalComments(comment.replies)
    return comment
  },

  /* 将嵌套评论树扁平化为列表（每项带 depth 层级），用于 wx:for 渲染 */
  flattenComments(comments, depth) {
    depth = depth || 0
    const result = []
    for (const c of comments) {
      c.depth = depth
      result.push(c)
      if (c.replies && c.replies.length > 0) {
        const children = this.flattenComments(c.replies, depth + 1)
        for (const child of children) {
          result.push(child)
        }
      }
    }
    return result
  },

  /* 将扁平评论按一级评论分组，每组包含 root 和所有子回复，默认折叠多余回复。
   * preserveGroups：可选，传入旧的分组列表，用于保留用户已手动展开的条数。 */
  groupComments(flatComments, preserveGroups) {
    // 从旧分组中提取各 rootId 的 expandedCount
    const expandedCountMap = {}
    if (preserveGroups && preserveGroups.length > 0) {
      for (const g of preserveGroups) {
        if (g.expandedCount > 0) expandedCountMap[String(g.rootId)] = g.expandedCount
      }
    }
    const groups = []
    let current = null
    for (const c of (flatComments || [])) {
      if (c.depth === 0) {
        const savedCount = expandedCountMap[String(c.id)]
        current = { root: c, rootId: c.id, replies: [], expandedCount: (typeof savedCount === 'number') ? savedCount : 0 }
        groups.push(current)
      } else if (current) {
        current.replies.push(c)
      }
    }
    return groups
  },

  /* 展开/折叠某一级评论下的回复：每次展开 8 条，全部展开后再点击收起 */
  toggleRepliesExpand(e) {
    const index = e.currentTarget.dataset.index
    const group = this.data.groupedComments[index]
    if (!group) return
    const REPLY_PAGE_SIZE = 8
    const hiddenCount = group.replies.length - 1 // 第一条始终可见，需要逐步展开的是剩余条数
    if (hiddenCount <= 0) return
    if (group.expandedCount >= hiddenCount) {
      // 已全部展开 → 先触发收起动画，延迟后再移除子元素
      this.setData({ [`groupedComments[${index}]._animClosing`]: true })
      setTimeout(() => {
        this.setData({
          [`groupedComments[${index}].expandedCount`]: 0,
          [`groupedComments[${index}]._animClosing`]: false
        })
      }, 350)
    } else {
      // 展开下一批（最多 8 条）
      const next = Math.min(group.expandedCount + REPLY_PAGE_SIZE, hiddenCount)
      this.setData({ [`groupedComments[${index}].expandedCount`]: next })
    }
  },

  /* 时间格式化：相对时间 */
  formatRelativeTime(dateStr) {
    if (!dateStr) return ''
    // 兼容数组格式 [2026,5,31,14,30,0]
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

    // 精确判断昨天和前天
    const isSameDay = (d1, d2) => {
      return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    }
    const nowDate = new Date()
    const yesterday = new Date(nowDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const beforeYesterday = new Date(nowDate)
    beforeYesterday.setDate(beforeYesterday.getDate() - 2)

    if (isSameDay(date, yesterday)) {
      const h = String(date.getHours()).padStart(2, '0')
      const m = String(date.getMinutes()).padStart(2, '0')
      return '昨天 ' + h + ':' + m
    }
    if (isSameDay(date, beforeYesterday)) {
      const h = String(date.getHours()).padStart(2, '0')
      const m = String(date.getMinutes()).padStart(2, '0')
      return '前天 ' + h + ':' + m
    }

    const days = Math.floor(hours / 24)
    if (days < 30) return days + '天前'
    // 超过30天显示具体日期
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  },

  normalizePost(source) {
    const post = {
      ...source,
      user: { ...(source.user || {}) },
      stats: { likes: 0, comments: 0, shares: 0, favorites: 0, ...(source.stats || {}) },
      images: source.images || []
    }

    if (!post.title) {
      post.title = post.content ? post.content.slice(0, 24) : '帖子详情'
    }

    return post
  },
  findMockPost(rawId, numericId) {
    const lists = [
      mock.posts || [],
      mock.marketItems || [],
      mock.errands || [],
      mock.ratings || [],
      mock.followingPosts || []
    ]
    const allPosts = [].concat(...lists)
    return allPosts.find(item => String(item.id) === String(rawId)) ||
      (!Number.isNaN(numericId) ? allPosts.find(item => item.id === numericId) : null)
  },
  goBack() {
    wx.navigateBack()
  },

  onShow() {
    // 检查是否从编辑页返回
    const editedPostStr = wx.getStorageSync('editedPostData')
    if (editedPostStr) {
      const editedPost = JSON.parse(editedPostStr)
      if (String(editedPost.id) === String(this.data.postId)) {
        const post = { ...this.data.post, ...editedPost }
        post.displayContent = post.fullContent || post.content
        this.setData({ post })
      }
      wx.removeStorageSync('editedPostData')
    }

    // 从其他页面返回时刷新关注状态（如从用户主页关注后返回）
    const post = this.data.post
    const userId = post.user && post.user.uid
    if (userId && !post.isOwn) {
      request({
        url: '/api/v1/follow/count/' + userId,
        method: 'GET'
      }).then(data => {
        if (this.data.post.isFollowed !== (data.followedByMe || false)) {
          const updatedPost = this.data.post
          updatedPost.isFollowed = data.followedByMe || false
          this.setData({ post: updatedPost })
        }
      }).catch(() => {})
    }
  },

  onSwiperChange(e) {
    this.setData({ swiperCurrent: e.detail.current })
  },
  toggleLike() {
    const post = this.data.post
    const isLiked = post.liked
    const newLiked = !isLiked
    const newLikes = Math.max(0, post.stats.likes + (newLiked ? 1 : -1))
    const url = isLiked ? '/api/post/unlike/' + post.id : '/api/post/like/' + post.id

    // 乐观更新：精准 setData，不传整个 post 对象
    this.setData({
      'post.liked': newLiked,
      'post.stats.likes': newLikes
    })

    request({
      url: url,
      method: 'POST'
    }).then(() => {
      if (newLiked) {
        wx.showToast({ title: '点赞成功', icon: 'success' })
      }
      // 将点赞状态同步到 storage，供浏览页 onShow 读取
      wx.setStorageSync('postLikeUpdate', { id: post.id, liked: newLiked, likeCount: newLikes })
    }).catch(err => {
      console.error('点赞操作失败:', err)
      // 精准回滚
      this.setData({
        'post.liked': isLiked,
        'post.stats.likes': post.stats.likes
      })
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none' })
    })
  },
  toggleFavorite() {
    const post = this.data.post
    const isFavorited = post.favorited
    const newFavorited = !isFavorited
    const newFavorites = Math.max(0, (post.stats.favorites || 0) + (newFavorited ? 1 : -1))
    const url = isFavorited ? '/api/post/unfavorite/' + post.id : '/api/post/favorite/' + post.id

    // 乐观更新：精准 setData
    this.setData({
      'post.favorited': newFavorited,
      'post.stats.favorites': newFavorites
    })

    request({
      url: url,
      method: 'POST'
    }).then(() => {
      wx.showToast({ title: newFavorited ? '已收藏' : '已取消收藏', icon: 'none' })
    }).catch(err => {
      console.error('收藏操作失败:', err)
      // 精准回滚
      this.setData({
        'post.favorited': isFavorited,
        'post.stats.favorites': post.stats.favorites
      })
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none' })
    })
  },
  toggleFollow() {
    const post = this.data.post
    const userId = post.user && post.user.uid
    if (!userId) return

    const isFollowed = post.isFollowed
    const method = isFollowed ? 'DELETE' : 'POST'

    request({
      url: '/api/v1/follow/' + userId,
      method: method
    }).then(() => {
      post.isFollowed = !isFollowed
      this.setData({ post })
      wx.showToast({ title: isFollowed ? '已取消关注' : '已关注', icon: 'none' })
    }).catch(err => {
      console.error('关注操作失败:', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    })
  },

  contactUser() {
    const { post } = this.data
    const userId = post.user && post.user.uid ? post.user.uid : ''
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${userId}&name=${post.user.name}&avatar=${encodeURIComponent(post.user.avatar)}`
    })
  },

  goToUserProfile(e) {
    const { uid, name, avatar } = e.currentTarget.dataset
    const currentUid = (app.globalData.userInfo || {}).uid
    // 如果是自己发的帖子，点击头像跳转到自己的 profile tab
    if (uid && String(uid) === String(currentUid)) {
      safeSwitch({ url: '/pages/profile/profile' })
      return
    }
    safeNavigate({
      url: `/pages/user-home/user-home?userId=${uid || ''}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`
    })
  },

  toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id
    const path = this.findCommentPath(commentId)
    if (!path) return

    const comment = this.getByPath(path)
    const isLiked = comment.liked
    const newLiked = !isLiked
    const newLikes = Math.max(0, (comment.likes || 0) + (newLiked ? 1 : -1))
    const url = isLiked ? '/api/post/comment/unlike/' + commentId : '/api/post/comment/like/' + commentId

    // 在 flatComments 中找到对应评论的索引
    const flatIndex = this.data.flatComments.findIndex(c => String(c.id) === String(commentId))

    // 在 groupedComments 中定位（root 或 replies）
    let groupIndex = -1
    let replyIndex = -1
    for (let i = 0; i < this.data.groupedComments.length; i++) {
      const g = this.data.groupedComments[i]
      if (String(g.root.id) === String(commentId)) {
        groupIndex = i
        break
      }
      const rIdx = g.replies.findIndex(r => String(r.id) === String(commentId))
      if (rIdx >= 0) {
        groupIndex = i
        replyIndex = rIdx
        break
      }
    }

    // 乐观更新：精准更新 comments 树、flatComments 列表和 groupedComments 列表
    const updates = {
      [path + '.liked']: newLiked,
      [path + '.likes']: newLikes
    }
    if (flatIndex >= 0) {
      updates[`flatComments[${flatIndex}].liked`] = newLiked
      updates[`flatComments[${flatIndex}].likes`] = newLikes
    }
    if (groupIndex >= 0) {
      if (replyIndex >= 0) {
        updates[`groupedComments[${groupIndex}].replies[${replyIndex}].liked`] = newLiked
        updates[`groupedComments[${groupIndex}].replies[${replyIndex}].likes`] = newLikes
      } else {
        updates[`groupedComments[${groupIndex}].root.liked`] = newLiked
        updates[`groupedComments[${groupIndex}].root.likes`] = newLikes
      }
    }
    this.setData(updates)

    request({
      url: url,
      method: 'POST'
    }).catch(err => {
      console.error('评论点赞操作失败:', err)
      // 精准回滚
      const rollback = {
        [path + '.liked']: isLiked,
        [path + '.likes']: comment.likes
      }
      if (flatIndex >= 0) {
        rollback[`flatComments[${flatIndex}].liked`] = isLiked
        rollback[`flatComments[${flatIndex}].likes`] = comment.likes
      }
      if (groupIndex >= 0) {
        if (replyIndex >= 0) {
          rollback[`groupedComments[${groupIndex}].replies[${replyIndex}].liked`] = isLiked
          rollback[`groupedComments[${groupIndex}].replies[${replyIndex}].likes`] = comment.likes
        } else {
          rollback[`groupedComments[${groupIndex}].root.liked`] = isLiked
          rollback[`groupedComments[${groupIndex}].root.likes`] = comment.likes
        }
      }
      this.setData(rollback)
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none' })
    })
  },

  /* 在评论树中定位指定 ID 的 data 路径，支持多层嵌套 */
  findCommentPath(commentId, basePath, list) {
    const comments = list || this.data.comments
    const base = basePath || 'comments'
    for (let i = 0; i < comments.length; i++) {
      const path = base + '[' + i + ']'
      if (String(comments[i].id) === String(commentId)) return path
      const replies = comments[i].replies
      if (replies && replies.length > 0) {
        const found = this.findCommentPath(commentId, path + '.replies', replies)
        if (found) return found
      }
    }
    return null
  },

  /* 根据 data 路径字符串获取值，如 getByPath("comments[1].replies[3]") */
  getByPath(path) {
    const parts = path.split('.')
    let obj = this.data
    for (const part of parts) {
      const m = part.match(/^(\w+)\[(\d+)\]$/)
      if (m) {
        obj = obj[m[1]][parseInt(m[2])]
      } else {
        obj = obj[part]
      }
    }
    return obj
  },
  /* 回复评论（点击评论上的回复图标） */
  replyComment(e) {
    const commentId = e.currentTarget.dataset.id
    const target = this.findCommentById(commentId)
    if (target) {
      this.setData({ replyTarget: { id: target.id, name: target.name } })
    }
  },

  /* 在 flatComments 中查找指定评论 ID 所属的顶级根评论 ID */
  findRootIdForComment(commentId) {
    const flat = this.data.flatComments
    if (!flat || flat.length === 0) return null
    for (let i = 0; i < flat.length; i++) {
      if (String(flat[i].id) === String(commentId)) {
        if (flat[i].depth === 0) return commentId
        // 向前找最近的 depth 0 评论
        for (let j = i - 1; j >= 0; j--) {
          if (flat[j].depth === 0) return flat[j].id
        }
        return null
      }
    }
    return null
  },

  /* 在评论树中查找指定 ID 的评论 */
  findCommentById(id) {
    const search = (list) => {
      for (const c of list) {
        if (String(c.id) === String(id)) return c
        if (c.replies && c.replies.length > 0) {
          const found = search(c.replies)
          if (found) return found
        }
      }
      return null
    }
    return search(this.data.comments)
  },

  addImage() {
    wx.showToast({ title: '选择图片', icon: 'none' })
  },

  /* 评论输入框内容变化 */
  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  /* 取消回复 */
  cancelReply() {
    this.setData({ replyTarget: null, commentInput: '' })
  },

  /* 递归在评论树中找到父评论并追加回复（支持多层嵌套） */
  addReplyToTree(comments, parentId, newReply) {
    return comments.map(c => {
      if (String(c.id) === String(parentId)) {
        const replies = c.replies ? [...c.replies, newReply] : [newReply]
        return { ...c, replies }
      }
      if (c.replies && c.replies.length > 0) {
        return { ...c, replies: this.addReplyToTree(c.replies, parentId, newReply) }
      }
      return c
    })
  },

  /* 提交评论 */
  submitComment() {
    const content = this.data.commentInput.trim()
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    const postId = Number(this.data.postId)
    if (!postId) return

    // 构建本地评论对象（乐观更新：先让用户看到自己的评论）
    const userInfo = app.globalData.userInfo || {}
    const now = new Date()
    const localComment = {
      id: 'local_' + Date.now(),
      userId: userInfo.uid || 0,
      name: userInfo.nickname || '我',
      avatar: userInfo.avatar || '',
      time: '刚刚',
      content: content,
      likes: 0,
      liked: false,
      replies: []
    }

    const replyTarget = this.data.replyTarget
    if (replyTarget) {
      localComment.replyTo = replyTarget.name
      // 递归找到父评论，追加到其 replies 中（支持多层嵌套）
      const comments = this.addReplyToTree(this.data.comments, replyTarget.id, localComment)
      const flatComments = this.flattenComments(comments)
      const groupedComments = this.groupComments(flatComments, this.data.groupedComments)
      // 被回复的组自动展开全部（用户刚回复了，应该看到自己的回复）
      const targetRootId = this.findRootIdForComment(replyTarget.id)
      if (targetRootId) {
        for (const g of groupedComments) {
          if (String(g.rootId) === String(targetRootId)) {
            g.expandedCount = g.replies.length - 1
            break
          }
        }
      }
      this.setData({ comments, flatComments, groupedComments, commentInput: '', replyTarget: null })
    } else {
      // 顶级评论：插入到列表最前面
      const comments = [localComment].concat(this.data.comments)
      const flatComments = this.flattenComments(comments)
      const groupedComments = this.groupComments(flatComments, this.data.groupedComments)
      this.setData({ comments, flatComments, groupedComments, commentInput: '' })
    }

    // 更新评论计数
    const post = this.data.post
    if (post.stats) post.stats.comments = (post.stats.comments || 0) + 1
    this.setData({ post })

    // 后台发送请求
    const dto = { postId, content }
    if (replyTarget) {
      dto.parentId = replyTarget.id
    }
    request({
      url: '/api/post/comment',
      method: 'POST',
      data: dto
    }).then(() => {
      // API 成功后重新加载评论，后端数据会替换乐观更新的本地数据
      this.loadComments(this.data.postId)
    }).catch(err => {
      console.error('评论发送失败:', err)
      // 本地已经显示了，不需要回退，只给一个轻提示
      wx.showToast({ title: (err && err.message) || '网络异常，评论仅本地可见', icon: 'none' })
    })
  },

  /* 删除评论 */
  deleteCommentAction() {
    const comment = this.data.selectedComment
    if (!comment) return
    this.hideCommentOptions()
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评论吗？',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          request({
            url: '/api/post/comment/' + comment.id,
            method: 'DELETE'
          }).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadComments(this.data.postId)
          }).catch(err => {
            console.error('删除评论失败:', err)
            wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  /* 显示操作弹窗 */
  showActionSheet() {
    this.setData({ showActionSheet: true })
  },

  /* 隐藏操作弹窗 */
  hideActionSheet() {
    this.setData({ showActionSheet: false })
  },

  /* 阻止冒泡 */
  preventBubble() {
    // do nothing
  },

  /* 编辑帖子 */
  editPost() {
    this.setData({ showActionSheet: false })
    const post = this.data.post
    // 将帖子数据存入 storage，供编辑页读取
    wx.setStorageSync('editPostData', JSON.stringify(post))
    safeNavigate({
      url: `/pages/publish-post/publish-post?editId=${post.id}`
    })
  },

  /* 设置为私密 */
  setPrivate() {
    this.setData({ showActionSheet: false })
    wx.showToast({ title: '已设置为私密', icon: 'success' })
  },

  /* 置顶帖子 */
  togglePinned() {
    this.setData({ showActionSheet: false })
    wx.showToast({ title: '已置顶', icon: 'success' })
  },

  /* 分享给互关好友 */
  shareToFriends() {
    this.setData({ showActionSheet: false })
    var postId = this.data.postId || (this.data.post && this.data.post.id)
    if (!postId) {
      wx.showToast({ title: '暂无帖子信息', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/share/share?postId=' + postId })
  },

  /* 分享给微信好友 */
  shareToWechat() {
    this.setData({ showActionSheet: false })
    wx.showToast({ title: '分享给微信好友', icon: 'none' })
  },

  /* 删除帖子 */
  deletePost() {
    this.setData({ showActionSheet: false })
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      }
    })
  },

  /* ========== 分享弹窗 ========== */

  showShareSheet() {
    this.setData({ showShareModal: true })
  },

  hideShareSheet() {
    this.setData({ showShareModal: false })
  },

  onShareSheetTap() {
    // 阻止冒泡
  },

  sharePostToFriends() {
    this.setData({ showShareModal: false })
    var postId = this.data.postId || (this.data.post && this.data.post.id)
    if (!postId) {
      wx.showToast({ title: '暂无帖子信息', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/share/share?postId=' + postId })
  },

  reportPost() {
    this.setData({ showShareModal: false })
    this.setData({
      showReportModal: true,
      reportTargetType: 1,
      reportTargetId: this.data.postId,
      reportSelectedReason: 0,
      reportRemark: '',
      reportSubmitting: false
    })
  },

  /* ========== 评论选项弹窗 ========== */

  /* 显示评论选项弹窗（递归查找，支持多层嵌套） */
  showCommentOptions(e) {
    const { id, name, content } = e.currentTarget.dataset
    // 递归在评论树中查找
    const comment = this.findCommentById(id)
    const userInfo = app.globalData.userInfo || {}
    const isOwn = comment && String(comment.userId) === String(userInfo.uid)
    this.setData({
      showCommentOptionsModal: true,
      selectedComment: comment || { id, name, content },
      commentIsOwn: isOwn
    })
  },

  /* 隐藏评论选项弹窗 */
  hideCommentOptions() {
    this.setData({
      showCommentOptionsModal: false,
      selectedComment: null
    })
  },

  /* 阻止弹窗内容点击冒泡 */
  onCommentSheetTap() {
    // 什么都不做，只是阻止冒泡
  },

  /* 复制评论内容 */
  copyComment() {
    const comment = this.data.selectedComment
    if (comment && comment.content) {
      wx.setClipboardData({
        data: comment.content,
        success: () => {
          wx.showToast({ title: '已复制', icon: 'success' })
        }
      })
    }
    this.hideCommentOptions()
  },

  /* 回复评论（从操作弹窗） */
  replyCommentAction() {
    const comment = this.data.selectedComment
    this.hideCommentOptions()
    if (comment) {
      this.setData({ replyTarget: { id: comment.id, name: comment.name } })
    }
  },

  /* 分享评论给互关好友 */
  shareCommentToFriends() {
    this.hideCommentOptions()
    wx.showToast({ title: '分享给互关好友', icon: 'none' })
  },

  /* 分享评论给微信好友 */
  shareCommentToWechat() {
    this.hideCommentOptions()
    wx.showToast({ title: '分享给微信好友', icon: 'none' })
  },

  /* 举报评论 */
  reportComment() {
    this.hideCommentOptions()
    const comment = this.data.selectedComment
    this.setData({
      showReportModal: true,
      reportTargetType: 2,
      reportTargetId: comment ? comment.id : '',
      reportSelectedReason: 0,
      reportRemark: '',
      reportSubmitting: false
    })
  },

  /* ========== 举报弹窗 ========== */

  /* 隐藏举报弹窗 */
  hideReportModal() {
    this.setData({ showReportModal: false })
  },

  /* 阻止举报弹窗内容冒泡 */
  onReportSheetTap() {
    // do nothing
  },

  /* 选择举报原因 */
  onReportReasonSelect(e) {
    const { code } = e.currentTarget.dataset
    this.setData({ reportSelectedReason: code })
  },

  /* 举报备注输入 */
  onReportRemarkInput(e) {
    this.setData({ reportRemark: e.detail.value })
  },

  /* 提交举报 */
  submitReport() {
    if (!this.data.reportSelectedReason) {
      wx.showToast({ title: '请选择举报原因', icon: 'none' })
      return
    }
    if (this.data.reportSubmitting) return
    this.setData({ reportSubmitting: true })
    const dto = {
      targetType: this.data.reportTargetType,
      targetId: Number(this.data.reportTargetId),
      reason: this.data.reportSelectedReason,
      remark: this.data.reportRemark.trim() || undefined
    }
    request({
      url: '/api/v1/report',
      method: 'POST',
      data: dto
    }).then(() => {
      this.setData({ showReportModal: false, reportSubmitting: false })
      wx.showToast({ title: '举报已提交', icon: 'success' })
    }).catch(err => {
      console.error('举报提交失败:', err)
      this.setData({ reportSubmitting: false })
      wx.showToast({ title: (err && err.message) || '提交失败，请重试', icon: 'none' })
    })
  }
})
