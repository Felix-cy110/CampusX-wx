const { request, toFullUrl } = require('../../utils/request.js')
const { safeNavigate } = require('../../utils/safeNavigate')

// 帖子状态映射
const POST_STATUS_MAP = { 1: '可联系', 2: '已关闭', 3: '违规删除' }
// 模块标识 → tab 名
const MODULE_TABS = { 1: '图文', 2: '租赁', 3: '二手' }

Page({
  data: {
    keyword: '',
    currentTab: '一切帖子',
    tabs: ['一切帖子', '图文', '二手', '评分', '用户'],
    searchUsers: [],
    searchPosts: [],      // 帖子模块结果
    rentalPosts: [],      // 租赁模块结果（归一化展示）
    idlePosts: [],        // 闲置模块结果（归一化展示）
    filteredPosts: [],
    showUsers: false,     // 默认隐藏，切换到"用户"tab 时显示
    showPosts: true,
    loading: true,
    emptyText: '暂无搜索结果',
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    const keyword = decodeURIComponent(options.keyword || '')
    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      keyword: keyword
    })

    if (keyword) {
      this.doSearch(keyword)
    } else {
      this.setData({ loading: false, emptyText: '请输入搜索关键词' })
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  /**
   * 执行搜索请求
   */
  doSearch(keyword) {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const campusId = userInfo.campusId

    if (!campusId) {
      // 未加入学校，无法搜索
      this.setData({
        loading: false,
        emptyText: '请先加入学校后再搜索',
        searchPosts: [],
        filteredPosts: []
      })
      return
    }

    this.setData({ loading: true })

    // 请求所有模块（帖子 + 租赁 + 闲置 + 用户）
    request({
      url: '/api/v1/search/global',
      method: 'GET',
      data: {
        keyword: keyword,
        targetCampusId: campusId,
        modules: '1,2,3,4',
        pageSize: 20
      }
    }).then(res => {
      // 归一化各模块结果为统一展示格式
      const searchPosts = (res.posts && res.posts.list) ? res.posts.list.map(normalizePost) : []
      const rentalPosts = (res.rentalProducts && res.rentalProducts.list) ? res.rentalProducts.list.map(normalizeRental) : []
      const idlePosts = (res.idleProducts && res.idleProducts.list) ? res.idleProducts.list.map(normalizeIdle) : []
      const searchUsers = (res.users && res.users.list) ? res.users.list.map(normalizeUser) : []

      this.setData({
        searchPosts: searchPosts,
        rentalPosts: rentalPosts,
        idlePosts: idlePosts,
        searchUsers: searchUsers,
        loading: false
      })

      // 默认展示「一切帖子」= 全部合并
      this.applyTabFilter('一切帖子')

      // 结果返回后再保存搜索历史，和结果同步出现
      saveSearchHistory(keyword)
    }).catch(err => {
      console.error('搜索请求失败:', err)
      this.setData({
        loading: false,
        emptyText: '搜索失败，请稍后重试',
        searchPosts: [],
        filteredPosts: []
      })
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    this.applyTabFilter(tab)
  },

  /**
   * 按当前选中的 tab 过滤展示数据
   */
  applyTabFilter(tab) {
    if (tab === '用户') {
      this.setData({
        filteredPosts: [],
        showUsers: true,
        showPosts: false,
        emptyText: this.data.searchUsers.length === 0 ? '暂无匹配用户' : ''
      })
    } else if (tab === '评分') {
      this.setData({
        filteredPosts: [],
        showUsers: false,
        showPosts: false,
        emptyText: '评分搜索暂不支持'
      })
    } else if (tab === '一切帖子') {
      // 合并所有模块结果
      const all = [...this.data.searchPosts, ...this.data.rentalPosts, ...this.data.idlePosts]
      this.setData({
        filteredPosts: all,
        showUsers: false,
        showPosts: true
      })
    } else if (tab === '图文') {
      this.setData({
        filteredPosts: this.data.searchPosts,
        showUsers: false,
        showPosts: true
      })
    } else if (tab === '二手') {
      this.setData({
        filteredPosts: this.data.idlePosts,
        showUsers: false,
        showPosts: true
      })
    }
  },

  onFilter() {
    wx.showToast({ title: '筛选功能', icon: 'none' })
  },

  onTapUser(e) {
    wx.showToast({ title: '查看用户主页', icon: 'none' })
  },

  onFollow(e) {
    const userId = e.currentTarget.dataset.userId
    if (!userId) {
      wx.showToast({ title: '用户信息不完整', icon: 'none' })
      return
    }
    request({
      url: '/api/v1/follow/' + userId,
      method: 'POST'
    }).then(() => {
      wx.showToast({ title: '已关注', icon: 'success' })
    }).catch(err => {
      console.error('关注失败:', err)
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  onTapPost(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    // 将当前帖子状态（含乐观更新的点赞）传递给详情页
    const post = this.data.filteredPosts.find(item => String(item.id) === String(id))
    if (post) {
      wx.setStorageSync('selectedPostDetail', post)
      // 根据类型跳转不同详情页
      let url = ''
      if (post.type === 'rental' || post.type === 'idle') {
        url = `/pages/market-detail/market-detail?id=${post.id}`
      } else {
        url = `/pages/post-detail/post-detail?id=${post.id}`
      }
      safeNavigate({ url })
    }
  },

  /* 列表点赞/取消赞（乐观更新） */
  toggleFeedLike(e) {
    const { id, index } = e.currentTarget.dataset
    const dataList = this.data.filteredPosts
    if (!dataList || index === undefined || index >= dataList.length) return
    const item = dataList[index]
    if (String(item.id) !== String(id)) return

    const isLiked = item.liked
    const newLiked = !isLiked
    const newLikes = Math.max(0, (item.stats.likes || 0) + (newLiked ? 1 : -1))
    const apiUrl = isLiked ? '/api/post/unlike/' + id : '/api/post/like/' + id

    // 乐观更新
    this.setData({
      ['filteredPosts[' + index + '].liked']: newLiked,
      ['filteredPosts[' + index + '].stats.likes']: newLikes
    })

    request({ url: apiUrl, method: 'POST' }).then(() => {
      // 同步点赞状态，供其他页面读取
      wx.setStorageSync('postLikeUpdate', { id: id, liked: newLiked, likeCount: newLikes })
    }).catch(err => {
      console.error('点赞操作失败:', err)
      // 回滚
      this.setData({
        ['filteredPosts[' + index + '].liked']: isLiked,
        ['filteredPosts[' + index + '].stats.likes']: item.stats.likes
      })
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  onShow() {
    // 从详情页返回时同步点赞状态
    const update = wx.getStorageSync('postLikeUpdate')
    if (update && update.id) {
      wx.removeStorageSync('postLikeUpdate')
      const list = this.data.filteredPosts
      if (list) {
        const idx = list.findIndex(item => String(item.id) === String(update.id))
        if (idx >= 0) {
          this.setData({
            ['filteredPosts[' + idx + '].liked']: update.liked,
            ['filteredPosts[' + idx + '].stats.likes']: update.likeCount
          })
        }
      }
    }
  }
})

/**
 * 将 PostListVO 转为页面展示格式
 */
function normalizePost(vo) {
  return {
    id: vo.id,
    user: {
      name: vo.nickname || '匿名用户',
      avatar: toFullUrl(vo.avatarUrl) || '/images/avatars/default.png'
    },
    title: vo.title || '',
    content: vo.content || '',
    images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
    stats: {
      likes: vo.likeCount || 0,
      comments: vo.commentCount || 0
    },
    liked: vo.liked || false,
    time: formatRelativeTime(vo.createdAt),
    status: POST_STATUS_MAP[vo.status] || '未知',
    price: 0,
    type: 'post'
  }
}

/**
 * 将 RentalProduct 实体转为页面展示格式（字段名与后端实体对齐）
 */
function normalizeRental(product) {
  return {
    id: product.id,
    user: {
      name: product.publisherName || product.nickname || '匿名用户',
      avatar: toFullUrl(product.publisherAvatar || product.avatarUrl) || '/images/avatars/default.png'
    },
    title: product.title || '',
    content: product.description || product.content || '',
    images: product.coverImage ? [toFullUrl(product.coverImage)] : (product.imageUrl ? [toFullUrl(product.imageUrl)] : []),
    stats: {
      likes: product.likeCount || 0,
      comments: product.commentCount || 0
    },
    liked: false,
    time: formatRelativeTime(product.createdAt),
    status: product.status === 2 ? '可联系' : '已下架',
    price: product.price || product.dailyRent || 0,
    type: 'rental'
  }
}

/**
 * 将 IdleProduct 实体转为页面展示格式
 */
function normalizeIdle(product) {
  return {
    id: product.id,
    user: {
      name: product.sellerName || product.nickname || '匿名用户',
      avatar: toFullUrl(product.sellerAvatar || product.avatarUrl) || '/images/avatars/default.png'
    },
    title: product.title || '',
    content: product.description || product.content || '',
    images: product.coverImage ? [toFullUrl(product.coverImage)] : (product.imageUrl ? [toFullUrl(product.imageUrl)] : []),
    stats: {
      likes: product.likeCount || 0,
      comments: product.commentCount || 0
    },
    liked: false,
    time: formatRelativeTime(product.createdAt),
    status: product.status === 1 ? '可联系' : '已下架',
    price: product.price || 0,
    type: 'idle'
  }
}

/**
 * 将 UserProfileVO 转为页面展示格式
 */
function normalizeUser(vo) {
  return {
    userId: vo.userId,
    name: vo.nickname || '匿名用户',
    avatar: toFullUrl(vo.avatarUrl) || '/images/avatars/default.png',
    school: vo.campusName || ''
  }
}

/**
 * 简单相对时间格式化
 * 后端返回的 LocalDateTime 经 JSON 序列化后可能是数组 [2026,6,2,11,30,0] 或字符串 "2026-06-02T11:30:00"
 */
function formatRelativeTime(dateValue) {
  if (!dateValue) return ''
  let date
  if (Array.isArray(dateValue)) {
    date = new Date(dateValue[0], dateValue[1] - 1, dateValue[2], dateValue[3] || 0, dateValue[4] || 0, dateValue[5] || 0)
  } else if (typeof dateValue === 'string') {
    date = new Date(dateValue.replace('T', ' ').replace('Z', ''))
  } else {
    return String(dateValue)
  }
  if (isNaN(date.getTime())) return ''

  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return minutes + '分钟前'
  if (hours < 24) return hours + '小时前'
  if (days < 30) return days + '天前'
  return Math.floor(days / 30) + '个月前'
}

/**
 * 搜索结果返回后，将关键词写入本地搜索历史
 * 与 search.js 共用同一个 storage key，保证数据一致
 */
function saveSearchHistory(keyword) {
  const HISTORY_KEY = 'searchHistory'
  const MAX_HISTORY = 20
  let history = wx.getStorageSync(HISTORY_KEY) || []
  const idx = history.indexOf(keyword)
  if (idx !== -1) history.splice(idx, 1)
  history.unshift(keyword)
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY)
  wx.setStorageSync(HISTORY_KEY, history)
}
