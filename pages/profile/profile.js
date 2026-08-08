const app = getApp()
const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')

Page({
  data: {
    isLoggedIn: true,
    userInfo: {
      stats: { following: 0, followers: 0, likes: 0 }
    },
    currentSubTab: 'published',   // 'published' | 'favorited'
    currentContentTab: 'posts',   // 'posts' | 'market' | 'errand'
    subIndicatorRatio: 0.25,
    contentIndicatorRatio: 0.1667,
    allContentList: [],           // 全部内容数据
    filteredContentList: [],       // 根据Tab筛选后的列表
    showPostOptionsModal: false,   // 帖子选项弹窗
    selectedPostId: null,          // 当前选中的帖子ID
    selectedPostIsPrivate: false,  // 当前选中帖子是否私密
    selectedPostIsPinned: false,   // 当前选中帖子是否置顶
    _scrollTop: 0,

    /* 内容分页 */
    contentPage: 1,
    contentCursor: null,
    contentHasMore: true,
    contentLoading: false,
    loadingMore: false,

    /* 下拉刷新 */
    refreshing: false,

    /* 自定义导航栏尺寸 */
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      isLoggedIn: app.globalData.isLoggedIn
    })

    // 先从缓存加载，再请求最新数据
    if (app.globalData.userInfo && app.globalData.userInfo.uid) {
      this.setData({ userInfo: app.globalData.userInfo })
    }
    this.fetchUserProfile()
    this.loadContentData()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo
    })
    // 每次显示页面时刷新用户信息和内容
    this.fetchUserProfile()
    this.loadContentData()
  },

  /* 从后端获取用户信息 */
  fetchUserProfile() {
    request({
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
      this.fetchFollowCounts(vo.userId)
    }).catch(err => {
      console.error('获取用户信息失败:', err)
      // 静默失败，保持缓存数据
    })
  },

  /* 获取关注/粉丝数 */
  fetchFollowCounts(userId) {
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
    this.setData({
      contentPage: 1,
      contentCursor: null,
      contentHasMore: true,
      contentLoading: true,
      filteredContentList: []
    })
    const { currentSubTab, currentContentTab } = this.data
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

  /* 加载更多（滚动到底部） */
  onContentLoadMore() {
    if (!this.data.contentHasMore || this.data.loadingMore || this.data.contentLoading) return
    this.setData({ loadingMore: true })
    const { currentSubTab, currentContentTab } = this.data
    if (currentSubTab === 'published') {
      this._loadPublished(true)
    } else {
      this._loadFavorited(true)
    }
  },

  /* ===== 我发布的 ===== */

  _loadPublished(isLoadMore) {
    const { currentContentTab } = this.data
    switch (currentContentTab) {
      case 'posts': return this._fetchMyPosts(isLoadMore)
      case 'market': return this._fetchMyIdleProducts(isLoadMore)
      case 'errand': return this._fetchMyProxyItems(isLoadMore)
      default: return this._finishLoading([], false)
    }
  },

  /* ===== 我的收藏 ===== */

  _loadFavorited(isLoadMore) {
    const { currentContentTab } = this.data
    switch (currentContentTab) {
      case 'posts': return this._fetchFavoritePosts(isLoadMore)
      case 'market': return this._fetchFavoriteIdle(isLoadMore)
      case 'errand': return this._finishLoading([], false) // 暂无收藏跑腿 API
      default: return this._finishLoading([], false)
    }
  },

  /* ===== API 调用：我发布的动态 ===== */
  _fetchMyPosts(isLoadMore) {
    const data = { pageSize: 20 }
    if (isLoadMore && this.data.contentCursor) {
      data.cursor = this.data.contentCursor
    }
    request({ url: '/api/post/my', data }).then(result => {
      const list = (result.list || []).map(vo => this._mapPostToCard(vo))
      const nextCursor = result.nextCursor || null
      const hasMore = result.hasMore || false
      this._finishLoading(list, hasMore, nextCursor)
    }).catch(err => {
      console.error('获取我的帖子失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== API 调用：我发布的二手 ===== */
  _fetchMyIdleProducts(isLoadMore) {
    const pageNum = isLoadMore ? this.data.contentPage + 1 : 1
    request({
      url: '/api/v1/idle/product/my-list',
      data: { pageNum, pageSize: 20 }
    }).then(result => {
      const list = (result.list || result.records || []).map(vo => this._mapIdleToCard(vo))
      const totalPages = result.pages || 1
      const hasMore = pageNum < totalPages
      this.setData({ contentPage: pageNum })
      this._finishLoading(list, hasMore)
    }).catch(err => {
      console.error('获取我的二手商品失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== API 调用：我发布的跑腿 ===== */
  _fetchMyProxyItems(isLoadMore) {
    const pageNum = isLoadMore ? this.data.contentPage + 1 : 1
    const pageSize = 10
    // 同时拉取代课需求和供给
    Promise.all([
      request({ url: '/api/v1/proxy-class-demand/my-list', data: { pageNum, pageSize } }).catch(() => null),
      request({ url: '/api/v1/proxy-class-supply/my-list', data: { pageNum, pageSize } }).catch(() => null)
    ]).then(([demandResult, supplyResult]) => {
      const demands = (demandResult && (demandResult.list || demandResult.records || [])).map(vo => this._mapProxyDemandToCard(vo))
      const supplies = (supplyResult && (supplyResult.list || supplyResult.records || [])).map(vo => this._mapProxySupplyToCard(vo))
      // 按时间倒序合并
      const list = [...demands, ...supplies].sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
      const demandPages = demandResult ? (demandResult.pages || 1) : 1
      const supplyPages = supplyResult ? (supplyResult.pages || 1) : 1
      const hasMore = pageNum < Math.max(demandPages, supplyPages)
      this.setData({ contentPage: pageNum })
      this._finishLoading(list, hasMore)
    }).catch(err => {
      console.error('获取我的跑腿失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== API 调用：收藏的动态 ===== */
  _fetchFavoritePosts(isLoadMore) {
    const pageNum = isLoadMore ? this.data.contentPage + 1 : 1
    request({
      url: '/api/v1/favorite/list',
      data: { targetType: 3, pageNum, pageSize: 20 }
    }).then(result => {
      const list = (result.list || result.records || []).map(vo => this._mapFavoriteToCard(vo))
      const totalPages = result.pages || 1
      const hasMore = pageNum < totalPages
      this.setData({ contentPage: pageNum })
      this._finishLoading(list, hasMore)
    }).catch(err => {
      console.error('获取收藏帖子失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== API 调用：收藏的二手 ===== */
  _fetchFavoriteIdle(isLoadMore) {
    const pageNum = isLoadMore ? this.data.contentPage + 1 : 1
    request({
      url: '/api/v1/favorite/list',
      data: { targetType: 2, pageNum, pageSize: 20 }
    }).then(result => {
      const list = (result.list || result.records || []).map(vo => this._mapFavoriteToCard(vo))
      const totalPages = result.pages || 1
      const hasMore = pageNum < totalPages
      this.setData({ contentPage: pageNum })
      this._finishLoading(list, hasMore)
    }).catch(err => {
      console.error('获取收藏二手失败:', err)
      this._finishLoading([], false)
    })
  },

  /* ===== 完成加载，更新列表 ===== */
  _finishLoading(newList, hasMore, nextCursor) {
    const list = this.data.loadingMore
      ? this.data.filteredContentList.concat(newList)
      : newList
    this.setData({
      filteredContentList: list,
      contentHasMore: hasMore,
      contentCursor: nextCursor !== undefined ? nextCursor : this.data.contentCursor,
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
      isPrivate: vo.status !== 1,
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
    const statusMap = { 0: 'pending', 1: 'available', 2: 'off_shelf', 3: 'sold', 4: 'rejected', 5: 'pending' }
    return {
      id: 'idle_' + vo.productId,
      type: 'market',
      pinned: false,
      isPrivate: false,
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
      _subType: vo.subType,
      _createdAt: _parseTime(vo.createdAt)
    }
  },

  /* ===== 数据映射：MyProxyClassDemandVO → 前端卡片 ===== */
  _mapProxyDemandToCard(vo) {
    const userInfo = this.data.userInfo || {}
    const statusText = vo.status === 0 ? 'available' : 'taken'
    const detailParts = []
    if (vo.locationBuilding) detailParts.push(vo.locationBuilding)
    if (vo.locationRoom) detailParts.push(vo.locationRoom)
    const detail = detailParts.length > 0 ? '（' + detailParts.join(' ') + '）' : ''
    const feeText = vo.fee != null ? ' 代课费¥' + vo.fee : ''
    return {
      id: 'demand_' + vo.id,
      type: 'errand',
      pinned: false,
      isPrivate: false,
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
      _createdAt: _parseTime(vo.createdAt)
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
      isPrivate: false,
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
      _createdAt: _parseTime(vo.createdAt)
    }
  },

  /* ===== 数据映射：UserFavoriteItemVO → 前端卡片 ===== */
  _mapFavoriteToCard(vo) {
    const type = vo.targetType === 3 ? 'posts' : 'market'
    return {
      id: 'fav_' + vo.favoriteId,
      type: type,
      pinned: false,
      isPrivate: false,
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || ''
      },
      time: _formatRelativeTime(vo.favoritedAt),
      content: vo.title || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      itemStatus: '',
      _backendId: vo.targetId,    // 跳转详情用原始对象 ID
      _backendType: type === 'posts' ? 'post' : 'idle',
      _favoriteId: vo.favoriteId,
      _createdAt: _parseTime(vo.favoritedAt)
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

  /* 切换内容类型Tab（动态/二手/跑腿） */
  switchContentTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.currentContentTab) return
    const map = { posts: 0, market: 1, errand: 2 }
    const index = map[tab] || 0
    this.setData({
      currentContentTab: tab,
      contentIndicatorRatio: (index + 0.5) / 3
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
  /* 点击列表项：根据类型跳转到对应详情页 */
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.filteredContentList.find(item => String(item.id) === String(id))
    if (!item) return

    const navId = item._backendId || item.id
    const itemType = item.type

    if (itemType === 'market') {
      // 二手商品 → market-detail
      wx.setStorageSync('selectedMarketItem', item)
      const subType = item._subType != null ? item._subType : 1
      safeNavigate({ url: '/pages/market-detail/market-detail?id=' + navId + '&subType=' + subType })
    } else if (itemType === 'errand') {
      // 跑腿 → errand-detail
      wx.setStorageSync('currentErrand', item)
      safeNavigate({ url: '/pages/errand-detail/errand-detail?id=' + navId })
    } else {
      // 动态帖子 → post-detail
      wx.setStorageSync('selectedPostDetail', item)
      safeNavigate({ url: '/pages/post-detail/post-detail?id=' + navId })
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
      selectedPostIsPrivate: post ? post.isPrivate : false,
      selectedPostIsPinned: post ? post.pinned : false
    })
  },

  /* 隐藏帖子选项弹窗 */
  hidePostOptions() {
    this.setTabBarHidden(false)
    this.setData({
      showPostOptionsModal: false,
      selectedPostId: null,
      selectedPostIsPrivate: false,
      selectedPostIsPinned: false
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

  /* 切换私密状态（暂为本地状态，后端无对应 API） */
  onSetPrivate() {
    const id = this.data.selectedPostId
    this.hidePostOptions()
    const list = this.data.filteredContentList.map(item => {
      if (String(item.id) === String(id)) {
        return { ...item, isPrivate: !item.isPrivate }
      }
      return item
    })
    this.setData({ filteredContentList: list })
    const post = list.find(item => String(item.id) === String(id))
    wx.showToast({ title: post && post.isPrivate ? '已设置为私密' : '已取消私密', icon: 'success' })
  },

  /* 切换置顶状态 */
  onSetPinned() {
    const id = this.data.selectedPostId
    const that = this
    this.hidePostOptions()

    const item = this.data.filteredContentList.find(item => String(item.id) === String(id))
    if (!item || item._backendType !== 'post') {
      wx.showToast({ title: '仅支持帖子置顶', icon: 'none' })
      return
    }

    const backendId = item._backendId
    const newPinned = !item.pinned

    wx.showLoading({ title: newPinned ? '置顶中...' : '取消置顶...' })
    request({ url: '/api/post/' + backendId + '/top', method: 'POST' })
      .then(() => {
        wx.hideLoading()
        const list = that.data.filteredContentList.map(i => {
          if (String(i.id) === String(id)) {
            return { ...i, pinned: newPinned }
          }
          return i
        })
        that.setData({ filteredContentList: list })
        wx.showToast({ title: newPinned ? '已置顶' : '已取消置顶', icon: 'success' })
      })
      .catch(err => {
        wx.hideLoading()
        console.error('置顶操作失败:', err)
        wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
      })
  },

  /* 分享给互关好友 */
  onShareToFriends() {
    const id = this.data.selectedPostId
    this.hidePostOptions()
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  },

  /* 分享给微信好友 */
  onShareToWechat() {
    const id = this.data.selectedPostId
    this.hidePostOptions()
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
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

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否确认删除？',
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

    wx.showLoading({ title: '删除中...' })
    deletePromise.then(() => {
      wx.hideLoading()
      const list = this.data.filteredContentList.filter(i => String(i.id) !== String(cardId))
      this.setData({ filteredContentList: list })
      wx.showToast({ title: '已删除', icon: 'success' })
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
