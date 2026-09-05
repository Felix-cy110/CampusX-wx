const app = getApp()
const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')
const { canAccessCampusFeatures } = require('../../utils/auth')

function buildShareTitle(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}

Page({
  data: {
    isLoggedIn: false,
    userInfo: {
      stats: { following: 0, followers: 0, likes: 0 }
    },
    currentSubTab: 'published',   // 'published' | 'favorited'
    subIndicatorRatio: 0.25,
    allContentList: [],           // 全部内容数据
    filteredContentList: [],       // 根据Tab筛选后的列表
    showPostOptionsModal: false,   // 帖子选项弹窗
    selectedPostId: null,          // 当前选中的帖子ID
    selectedPostIsPinned: false,   // 当前选中帖子是否置顶
    selectedPostBackendType: '',   // 当前选中内容的后端类型
    selectedPostBackendStatus: null, // 当前选中商品的后端状态
    _scrollTop: 0,

    /* 内容分页 */
    contentPage: 1,
    contentCursor: null,
    contentHasMore: true,
    contentLoading: false,
    loadingMore: false,

    /* 下拉刷新 */
    refreshing: false,

    /* 个人资料头部是否已收起（下滑浏览列表时收起，回到顶部时展开） */
    headerCollapsed: false,

    /* 自定义导航栏尺寸 */
    statusBarHeight: 0,
    navBarHeight: 0,
    /* 右上角按钮组与胶囊按钮之间的安全间距（px），根据胶囊实际位置动态计算 */
    capsuleGap: 0,
    /* 胶囊按钮高度（px），顶部按钮与之等高 */
    capsuleHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    // 微信官方安全区方案：getMenuButtonBoundingClientRect() 返回胶囊按钮的真实坐标，
    // 按钮组右缘到胶囊左缘留出 8px 间距，适配所有机型（iOS/Android/不同分辨率）
    const capsuleGap = systemInfo.windowWidth - menuButton.left + 8

    const isLoggedIn = !!wx.getStorageSync('token')
    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      capsuleGap: capsuleGap,
      capsuleHeight: menuButton.height,
      isLoggedIn
    })

    // 先从缓存加载，再请求最新数据
    if (app.globalData.userInfo && app.globalData.userInfo.uid) {
      this.setData({ userInfo: app.globalData.userInfo })
    }
    if (isLoggedIn) {
      this.fetchUserProfile()
      if (canAccessCampusFeatures()) this.loadContentData()
      else this.resetLoggedOutContent()
    } else {
      this.resetLoggedOutContent()
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    const isLoggedIn = !!wx.getStorageSync('token')
    this.setData({
      isLoggedIn,
      userInfo: app.globalData.userInfo
    })
    // 每次显示页面时刷新用户信息和内容
    if (isLoggedIn) {
      this.fetchUserProfile()
      if (canAccessCampusFeatures()) this.loadContentData()
      else this.resetLoggedOutContent()
    } else {
      this.resetLoggedOutContent()
    }
  },

  onShareAppMessage(res) {
    if (!res || res.from !== 'button') {
      return {
        title: 'CampusX 校园生活服务平台',
        path: '/pages/index/index'
      }
    }

    const dataset = (res.target && res.target.dataset) || {}
    const id = dataset.id || this.data.selectedPostId
    const item = this.data.filteredContentList.find(content => String(content.id) === String(id))
    if (!item) {
      return {
        title: 'CampusX 校园生活服务平台',
        path: '/pages/index/index'
      }
    }

    const backendId = item._backendId || item.id
    const backendType = item._backendType || 'post'
    const isIdle = backendType === 'idle'
    const isProxy = backendType === 'proxy_demand' || backendType === 'proxy_supply'
    let path
    if (isIdle) {
      path = '/pages/market-detail/market-detail?id=' + encodeURIComponent(backendId)
    } else if (isProxy) {
      path = '/pages/errand-detail/errand-detail?id=' + encodeURIComponent(backendId) +
        '&type=' + (backendType === 'proxy_supply' ? 'supply' : 'demand')
    } else {
      path = '/pages/post-detail/post-detail?id=' + encodeURIComponent(backendId)
    }
    const shareConfig = {
      title: buildShareTitle(item.content, isIdle ? '分享一个校园好物' : (isProxy ? '分享一个代课信息' : '分享一条校园动态')),
      path
    }
    if (item.images && item.images[0]) {
      shareConfig.imageUrl = item.images[0]
    }

    this.hidePostOptions()
    return shareConfig
  },

  resetLoggedOutContent() {
    this.setData({
      filteredContentList: [],
      contentHasMore: false,
      contentLoading: false,
      loadingMore: false,
      refreshing: false
    })
  },

  /* 从后端获取用户信息 */
  fetchUserProfile() {
    if (!wx.getStorageSync('token')) return Promise.resolve()
    return request({
      url: '/api/v1/user/me',
      method: 'GET'
    }).then(vo => {
      const userInfo = mapUserInfo(vo)
      // 合并已有的 stats（如果在 fetchFollowCounts 中已获取）
      const existingStats = this.data.userInfo.stats
      if (existingStats && (existingStats.following > 0 || existingStats.followers > 0)) {
        userInfo.stats = existingStats
      }

      this.setData({ userInfo })
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)

      // 获取关注/粉丝数
      if (canAccessCampusFeatures()) this.fetchFollowCounts(vo.userId)
    }).catch(err => {
      console.error('获取用户信息失败:', err)
      // 静默失败，保持缓存数据
    })
  },

  /* 获取关注/粉丝数 */
  fetchFollowCounts(userId) {
    if (!canAccessCampusFeatures()) return Promise.resolve()
    request({
      url: '/api/v1/follow/count/' + userId,
      method: 'GET'
    }).then(countVO => {
      const userInfo = this.data.userInfo
      userInfo.stats = {
        following: countVO.followingCount || 0,
        followers: countVO.followerCount || 0,
        likes: userInfo.stats ? (userInfo.stats.likes || 0) : 0
      }
      this.setData({ userInfo })
      app.globalData.userInfo = userInfo
    }).catch(err => {
      console.error('获取关注数失败:', err)
    })
  },

  /* 加载内容数据（根据当前 subTab + contentTab 调用对应 API） */
  loadContentData() {
    if (!canAccessCampusFeatures()) {
      this.resetLoggedOutContent()
      return Promise.resolve()
    }
    this.setData({
      contentPage: 1,
      contentCursor: null,
      contentHasMore: true,
      contentLoading: true,
      filteredContentList: []
    })
    const { currentSubTab } = this.data
    if (currentSubTab === 'published') {
      return this._loadPublished() || Promise.resolve()
    } else {
      return this._loadFavorited() || Promise.resolve()
    }
  },

  /* 下拉刷新 */
  onRefresh() {
    this.setData({ refreshing: true })
    Promise.all([
      this.fetchUserProfile(),
      this.loadContentData()
    ]).finally(() => {
      this.setData({ refreshing: false })
      wx.showToast({ title: '刷新成功', icon: 'none' })
    })
  },

  /* 列表滚动：下滑超过阈值收起个人资料头部 */
  onListScroll(e) {
    const scrollTop = e.detail.scrollTop
    if (!this.data.headerCollapsed && scrollTop > 60) {
      this.setData({ headerCollapsed: true })
    } else if (this.data.headerCollapsed && scrollTop <= 5) {
      // 兜底：scrollTop 可能停在小数值（高分屏），接近顶部即展开
      this.setData({ headerCollapsed: false })
    }
  },

  /* 滚回顶部（第一条内容）时重新展开个人资料头部 */
  onScrollToUpper() {
    if (this.data.headerCollapsed) {
      this.setData({ headerCollapsed: false })
    }
  },

  /* 加载更多（滚动到底部） */
  onContentLoadMore() {
    if (!this.data.contentHasMore || this.data.loadingMore || this.data.contentLoading) return
    this.setData({ loadingMore: true })
    const { currentSubTab } = this.data
    if (currentSubTab === 'published') {
      this._loadPublished(true)
    } else {
      this._loadFavorited(true)
    }
  },

  /* ===== 我发布的（合并二手 + 跑腿） ===== */

  _loadPublished(isLoadMore) {
    const pageNum = isLoadMore ? this.data.contentPage + 1 : 1
    return Promise.all([
      this._fetchMyPosts(isLoadMore).catch(() => ({ list: [], hasMore: false, nextCursor: null })),
      this._fetchMyIdleProducts(pageNum).catch(() => ({ list: [], hasMore: false })),
      this._fetchMyProxyItems(pageNum).catch(() => ({ list: [], hasMore: false }))
    ]).then(([posts, idle, errand]) => {
      if (posts.nextCursor) {
        this.setData({ contentCursor: posts.nextCursor })
      }
      const list = [...posts.list, ...idle.list, ...errand.list]
        .sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
      const hasMore = posts.hasMore || idle.hasMore || errand.hasMore
      this.setData({ contentPage: pageNum })
      this._finishLoading(list, hasMore)
    }).catch(err => {
      console.error('加载我发布的内容失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== API 调用：我发布的图文帖子（游标分页） ===== */
  _fetchMyPosts(isLoadMore) {
    const data = { pageSize: 20 }
    if (isLoadMore && this.data.contentCursor) {
      data.cursor = this.data.contentCursor
    }
    return request({ url: '/api/post/my', data }).then(result => {
      return {
        list: (result.list || []).filter(vo => !vo.sourceType).map(vo => this._mapPostToCard(vo)),
        hasMore: result.hasMore || false,
        nextCursor: result.nextCursor || null
      }
    })
  },

  /* ===== 我的收藏（合并动态 + 二手） ===== */

  _loadFavorited(isLoadMore) {
    const pageNum = isLoadMore ? this.data.contentPage + 1 : 1
    return Promise.all([
      this._fetchFavoritePosts(pageNum).catch(() => ({ list: [], hasMore: false })),
      this._fetchFavoriteIdle(pageNum).catch(() => ({ list: [], hasMore: false }))
    ]).then(([posts, idle]) => {
      const list = [...posts.list, ...idle.list]
        .sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
      const hasMore = posts.hasMore || idle.hasMore
      this.setData({ contentPage: pageNum })
      this._finishLoading(list, hasMore)
    }).catch(err => {
      console.error('加载我的收藏失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== API 调用：我发布的二手 ===== */
  _fetchMyIdleProducts(pageNum) {
    return request({
      url: '/api/v1/idle/product/my-list',
      data: { pageNum, pageSize: 20 }
    }).then(result => {
      const totalPages = result.pages || 1
      const records = result.list || result.records || []
      return {
        // “我发布的”是公开内容视图，已下架商品留在“我的二手”中管理，不在这里重新展示。
        list: records
          .filter(vo => ![2, 6].includes(Number(vo.status)))
          .map(vo => this._mapIdleToCard(vo)),
        hasMore: pageNum < totalPages
      }
    })
  },

  /* ===== API 调用：我发布的跑腿 ===== */
  _fetchMyProxyItems(pageNum) {
    const pageSize = 10
    // 同时拉取代课需求和供给
    return Promise.all([
      request({ url: '/api/v1/proxy-class-demand/my-list', data: { pageNum, pageSize } }).catch(() => null),
      request({ url: '/api/v1/proxy-class-supply/my-list', data: { pageNum, pageSize } }).catch(() => null)
    ]).then(([demandResult, supplyResult]) => {
      const demands = (demandResult && (demandResult.list || demandResult.records || [])).map(vo => this._mapProxyDemandToCard(vo))
      const supplies = (supplyResult && (supplyResult.list || supplyResult.records || [])).map(vo => this._mapProxySupplyToCard(vo))
      // 按时间倒序合并
      const list = [...demands, ...supplies].sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
      const demandPages = demandResult ? (demandResult.pages || 1) : 1
      const supplyPages = supplyResult ? (supplyResult.pages || 1) : 1
      return { list, hasMore: pageNum < Math.max(demandPages, supplyPages) }
    })
  },

  /* ===== API 调用：收藏的动态 ===== */
  _fetchFavoritePosts(pageNum) {
    return request({
      url: '/api/v1/favorite/list',
      data: { targetType: 3, pageNum, pageSize: 20 }
    }).then(result => {
      const totalPages = result.pages || 1
      return {
        list: (result.list || result.records || []).map(vo => this._mapFavoriteToCard(vo)),
        hasMore: pageNum < totalPages
      }
    })
  },

  /* ===== API 调用：收藏的二手 ===== */
  _fetchFavoriteIdle(pageNum) {
    return request({
      url: '/api/v1/favorite/list',
      data: { targetType: 2, pageNum, pageSize: 20 }
    }).then(result => {
      const totalPages = result.pages || 1
      return {
        list: (result.list || result.records || []).map(vo => this._mapFavoriteToCard(vo)),
        hasMore: pageNum < totalPages
      }
    })
  },

  /* ===== 完成加载，更新列表 ===== */
  _finishLoading(newList, hasMore) {
    const list = this.data.loadingMore
      ? this.data.filteredContentList.concat(newList)
      : newList
    this.setData({
      filteredContentList: list,
      contentHasMore: hasMore,
      contentLoading: false,
      loadingMore: false
    })
  },

  /* ===== 数据映射：PostListVO → 前端卡片 ===== */
  _mapPostToCard(vo) {
    const userInfo = this.data.userInfo || {}
    return {
      id: String(vo.id),
      type: 'posts',
      pinned: vo.isTop === 1,
      user: {
        uid: String(vo.userId || userInfo.uid),
        name: vo.nickname || userInfo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || userInfo.avatar || ''
      },
      time: _formatRelativeTime(vo.createdAt),
      content: vo.title || vo.content || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      itemStatus: '',
      _backendId: vo.id,
      _backendType: 'post',
      _createdAt: _parseTime(vo.createdAt)
    }
  },

  /* ===== 数据映射：IdleSellerProductVO → 前端卡片 ===== */
  _mapIdleToCard(vo) {
    const userInfo = this.data.userInfo || {}
    const statusMap = {
      0: 'pending',
      1: 'available',
      2: 'off-shelf',
      3: 'sold',
      4: 'rejected',
      5: 'pending',
      6: 'reserved'
    }
    return {
      id: 'idle_' + vo.productId,
      type: 'market',
      pinned: false,
      user: {
        uid: userInfo.uid || '',
        name: userInfo.nickname || '',
        avatar: userInfo.avatar || ''
      },
      time: _formatRelativeTime(vo.createdAt),
      content: vo.title || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: 0, comments: 0 },
      itemStatus: statusMap[vo.status] || '',
      _backendId: vo.productId,
      _backendType: 'idle',
      _backendStatus: Number(vo.status),
      _createdAt: _parseTime(vo.createdAt)
    }
  },

  /* ===== 数据映射：MyProxyClassDemandVO → 前端卡片 ===== */
  _mapProxyDemandToCard(vo) {
    const userInfo = this.data.userInfo || {}
    const statusMap = { 0: 'pending', 1: 'available', 2: 'taken', 3: 'completed', 4: 'closed', 5: 'rejected' }
    const statusText = statusMap[vo.status] || ''
    const detailParts = []
    if (vo.locationBuilding) detailParts.push(vo.locationBuilding)
    if (vo.locationRoom) detailParts.push(vo.locationRoom)
    const detail = detailParts.length > 0 ? '（' + detailParts.join(' ') + '）' : ''
    const feeText = vo.fee != null ? ' 代课费¥' + vo.fee : ''
    return {
      id: 'demand_' + vo.id,
      type: 'errand',
      pinned: false,
      user: {
        uid: userInfo.uid || '',
        name: userInfo.nickname || '',
        avatar: userInfo.avatar || ''
      },
      time: _formatRelativeTime(vo.createdAt),
      content: '【求代课】' + (vo.courseName || '') + detail + feeText,
      images: [],
      itemStatus: statusText,
      _backendId: vo.id,
      _backendType: 'proxy_demand',
      _createdAt: _parseTime(vo.createdAt),
      _raw: vo,
    }
  },

  /* ===== 数据映射：ProxyClassSupplyListVO → 前端卡片 ===== */
  _mapProxySupplyToCard(vo) {
    const userInfo = this.data.userInfo || {}
    const feeText = vo.expectedFee != null ? ' 期望报酬¥' + vo.expectedFee : ''
    return {
      id: 'supply_' + vo.id,
      type: 'errand',
      pinned: false,
      user: {
        uid: userInfo.uid || '',
        name: userInfo.nickname || '',
        avatar: userInfo.avatar || ''
      },
      time: _formatRelativeTime(vo.createdAt),
      content: '【可代课】' + (vo.subjectRange || '') + (vo.availableTime ? ' ' + vo.availableTime : '') + feeText,
      images: [],
      stats: { likes: 0, comments: 0 },
      itemStatus: 'available',
      _backendId: vo.id,
      _backendType: 'proxy_supply',
      _createdAt: _parseTime(vo.createdAt),
      _raw: vo,
    }
  },

  /* ===== 数据映射：UserFavoriteItemVO → 前端卡片 ===== */
  _mapFavoriteToCard(vo) {
    const type = vo.targetType === 3 ? 'posts' : 'market'
    return {
      id: 'fav_' + vo.favoriteId,
      type: type,
      pinned: false,
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || ''
      },
      time: _formatRelativeTime(vo.publishedAt || vo.favoritedAt),
      content: vo.title || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      itemStatus: '',
      _backendId: vo.targetId,    // 跳转详情用原始对象 ID
      _backendType: type === 'posts' ? 'post' : 'idle',
      _favoriteId: vo.favoriteId,
      _createdAt: _parseTime(vo.publishedAt || vo.favoritedAt)
    }
  },

  /* 切换子Tab（我发布的/我的收藏） */
  switchSubTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.currentSubTab) return
    const index = tab === 'published' ? 0 : 1
    this.setData({
      currentSubTab: tab,
      subIndicatorRatio: (index + 0.5) / 2
    })
    this.loadContentData()
  },

  /* 双击 tab 回到顶部 */
  scrollToTop() {
    this.setData({ _scrollTop: this.data._scrollTop ? 0 : 1 })
  },

  /* 导航方法 */
  goToEditProfile() { safeNavigate({ url: '/pages/edit-profile/edit-profile' }) },
  goToOrders() { safeNavigate({ url: '/pages/order/order' }) },
  goToMyBooklist() { safeNavigate({ url: '/pages/my-booklist/my-booklist' }) },
  goToAddress() { safeNavigate({ url: '/pages/address/address' }) },
  goToSchoolModify() { safeNavigate({ url: '/pages/exit-school/exit-school' }) },
  goToSchoolAppeal() { safeNavigate({ url: '/pages/school-appeal/school-appeal' }) },
  goToSettings() { safeNavigate({ url: '/pages/more-options/more-options' }) },
  goToLogin() { safeNavigate({ url: '/pages/login/login' }) },
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.filteredContentList.find(item => String(item.id) === String(id))
    if (post) {
      // 我发布的跑腿：跳转跑腿详情（需先组装数据塞 currentErrand）
      if (post._backendType === 'proxy_demand' || post._backendType === 'proxy_supply') {
        const raw = post._raw || {}
        const isSupply = post._backendType === 'proxy_supply'
        const demand = {
          id: raw.id,
          type: isSupply ? 'supply' : 'errand',
          user: post.user || {},
          title: isSupply ? (raw.subjectRange || '') : (raw.courseName || ''),
          content: isSupply ? (raw.availableTime || '') : [raw.locationCampus, raw.locationBuilding, raw.locationRoom].filter(Boolean).join(' '),
          reward: isSupply ? Number(raw.expectedFee || 0) : Number(raw.fee || 0),
          time: post.time || '',
          status: 'available',
          countdown: '',
          _raw: { onlySameSchool: raw.onlySameSchool }
        }
        wx.setStorageSync('currentErrand', demand)
        safeNavigate({ url: '/pages/errand-detail/errand-detail?id=' + raw.id })
        return
      }
      // 收藏列表跳转时用 _backendId（原始对象 ID）
      const navId = post._backendId || post.id
      if (post._backendType === 'idle') {
        safeNavigate({ url: '/pages/market-detail/market-detail?id=' + navId })
      } else {
        wx.setStorageSync('selectedPostDetail', post)
        safeNavigate({ url: '/pages/post-detail/post-detail?id=' + navId })
      }
    }
  },

  /* 关注/粉丝跳转 */
  goToFollowing() {
    safeNavigate({ url: '/pages/following/following' })
  },
  goToFollowers() {
    safeNavigate({ url: '/pages/followers/followers' })
  },

  /* 复制邀请码 */
  copyInviteCode() {
    const inviteCode = this.data.userInfo.inviteCode
    if (!inviteCode) return
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' })
      }
    })
  },

  /* 显示帖子选项弹窗 */
  showPostOptions(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.filteredContentList.find(item => String(item.id) === String(id))
    this.setTabBarHidden(true)
    this.setData({
      showPostOptionsModal: true,
      selectedPostId: id,
      selectedPostIsPinned: post ? post.pinned : false,
      selectedPostBackendType: post ? post._backendType : '',
      selectedPostBackendStatus: post && post._backendType === 'idle' ? post._backendStatus : null
    })
  },

  /* 隐藏帖子选项弹窗 */
  hidePostOptions() {
    this.setTabBarHidden(false)
    this.setData({
      showPostOptionsModal: false,
      selectedPostId: null,
      selectedPostIsPinned: false,
      selectedPostBackendType: '',
      selectedPostBackendStatus: null
    })
  },

  setTabBarHidden(hidden) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden })
    }
  },

  /* 阻止弹窗内容点击冒泡 */
  onSheetTap() {
    // 什么都不做，只是阻止冒泡
  },

  /* 编辑帖子 */
  onEditPost() {
    const id = this.data.selectedPostId
    this.hidePostOptions()
    // 将帖子数据存入 storage，供编辑页读取
    const post = this.data.filteredContentList.find(item => String(item.id) === String(id))
    if (post) {
      wx.setStorageSync('editPostData', JSON.stringify(post))
    }
    safeNavigate({ url: '/pages/publish-post/publish-post?editId=' + id })
  },

  /* 切换置顶状态（仅为管理员提供，暂为本地状态） */
  onSetPinned() {
    const id = this.data.selectedPostId
    this.hidePostOptions()
    const list = this.data.filteredContentList.map(item => {
      if (String(item.id) === String(id)) {
        return { ...item, pinned: !item.pinned }
      }
      return item
    })
    this.setData({ filteredContentList: list })
    const post = list.find(item => String(item.id) === String(id))
    wx.showToast({ title: post && post.pinned ? '已置顶' : '已取消置顶', icon: 'success' })
  },

  /* 分享给互关好友 */
  onShareToFriends() {
    const id = this.data.selectedPostId
    this.hidePostOptions()
    // 查找对应项获取后端 ID 和类型
    const item = this.data.filteredContentList.find(item => String(item.id) === String(id))
    if (!item) {
      wx.showToast({ title: '未找到该内容', icon: 'none' })
      return
    }
    const backendId = item._backendId
    const backendType = item._backendType || 'post'
    safeNavigate({ url: '/pages/share/share?targetId=' + backendId + '&targetType=' + backendType })
  },

  /* 删除帖子 */
  onDeletePost() {
    const id = this.data.selectedPostId
    const that = this
    this.hidePostOptions()

    // 查找对应项获取后端类型和 ID
    const item = this.data.filteredContentList.find(item => String(item.id) === String(id))
    if (!item) {
      wx.showToast({ title: '未找到该内容', icon: 'none' })
      return
    }

    const isIdle = item._backendType === 'idle'
    wx.showModal({
      title: isIdle ? '确认下架' : '确认删除',
      content: isIdle ? '下架后其他同学将无法看到该商品，是否确认下架？' : '删除后无法恢复，是否确认删除？',
      confirmColor: '#FF7878',
      success(res) {
        if (res.confirm) {
          that._deleteItem(item, id)
        }
      }
    })
  },

  /* 根据后端类型调用对应删除 API */
  _deleteItem(item, cardId) {
    const backendType = item._backendType || ''
    const backendId = item._backendId

    let deletePromise
    if (backendType === 'post') {
      deletePromise = request({ url: '/api/post/' + backendId, method: 'DELETE' })
    } else if (backendType === 'idle') {
      // 只有上架中的商品可以下架，不能用本地删卡片冒充后端操作成功。
      if (Number(item._backendStatus) !== 1) {
        wx.showToast({ title: '当前商品不可下架', icon: 'none' })
        return
      }
      deletePromise = request({ url: '/api/v1/idle/product/' + backendId + '/off-shelf', method: 'PUT' })
    } else if (backendType === 'proxy_demand') {
      deletePromise = request({ url: '/api/v1/proxy-class-demand/close', method: 'POST', data: { id: backendId } })
    } else if (backendType === 'proxy_supply') {
      deletePromise = request({ url: '/api/v1/proxy-class-supply/close', method: 'POST', data: { id: backendId } })
    } else {
      // 未知类型（如收藏），仅从列表移除
      const list = this.data.filteredContentList.filter(i => String(i.id) !== String(cardId))
      this.setData({ filteredContentList: list })
      wx.showToast({ title: '已删除', icon: 'success' })
      return
    }

    wx.showLoading({ title: backendType === 'idle' ? '下架中...' : '删除中...' })
    deletePromise.then(() => {
      wx.hideLoading()
      const list = this.data.filteredContentList.filter(i => String(i.id) !== String(cardId))
      this.setData({ filteredContentList: list })
      wx.showToast({ title: backendType === 'idle' ? '已下架' : '已删除', icon: 'success' })
    }).catch(err => {
      wx.hideLoading()
      console.error('删除失败:', err)
      wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
    })
  },
})

/**
 * 将后端 UserInfoVO 映射为前端展示格式（profile WXML 使用的字段名）
 */
function mapUserInfo(vo) {
  return {
    uid: String(vo.userId),
    nickname: vo.nickname || '',
    avatar: toFullUrl(vo.avatarUrl) || '',
    phone: vo.phone || '',
    campusId: vo.campusId,
    school: vo.campusName || '',
    departmentId: vo.departmentId,
    department: vo.departmentName || '',
    majorId: vo.majorId,
    major: vo.majorName || '',
    enrollYear: vo.enrollmentYear || '',
    inviteCode: vo.inviteCode || '',
    invitedByUserId: vo.invitedByUserId,
    invitedBy: vo.invitedByUserName || null,
    nextModifyDays: vo.daysUntilNextModify,
    stats: { following: 0, followers: 0, likes: vo.likedCount || 0 }
  }
}

/**
 * 将后端时间转为时间戳（毫秒），兼容 ISO 字符串和数组格式
 */
function _parseTime(dateStr) {
  if (!dateStr) return 0
  let date
  if (Array.isArray(dateStr)) {
    date = new Date(dateStr[0], dateStr[1] - 1, dateStr[2],
      dateStr[3] || 0, dateStr[4] || 0, dateStr[5] || 0)
  } else {
    date = new Date(String(dateStr).replace('T', ' ').replace(/-/g, '/'))
  }
  return isNaN(date.getTime()) ? 0 : date.getTime()
}

/**
 * 将后端时间转为相对时间文本
 */
function _formatRelativeTime(dateStr) {
  const ts = _parseTime(dateStr)
  if (!ts) return ''
  const now = Date.now()
  const diff = now - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + '分钟前'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + '小时前'
  const days = Math.floor(hours / 24)
  if (days < 30) return days + '天前'
  const date = new Date(ts)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}
