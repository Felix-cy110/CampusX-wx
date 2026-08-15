const mock = require('../../utils/mock.js')
const app = getApp()
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')
const { canAccessCampusFeatures, requireAuth } = require('../../utils/auth')

function pad2(value) {
  const text = String(value == null ? 0 : value)
  return text.length < 2 ? '0' + text : text
}

function readObjectStorage(key) {
  const value = wx.getStorageSync(key)
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function getErrorMessage(error) {
  if (error && error.message) return String(error.message)
  if (error && error.errMsg) return String(error.errMsg)
  try {
    return JSON.stringify(error) || '未知错误'
  } catch (e) {
    return String(error || '未知错误')
  }
}

Page({
  data: {
    isLoggedIn: false,
    isJoinedSchool: false,
    feedType: 'recommend',
    currentTab: 'feed',
    feedSwiperIndex: 0,
    feedIndicatorRatio: 0.25,
    innerSwiperIndex: 0,
    marketSubTab: 'book',
    marketIndicatorRatio: 0.25,

    /* 自定义导航栏尺寸 */
    statusBarHeight: 0,
    navBarHeight: 0,
    navBarRight: 0,

    /* 分类方块 */
    categorySquares: [
      { key: 'feed', label: '帖子', icon: '/images/SVG/帖子.svg' },
      { key: 'market', label: '二手', icon: '/images/SVG/二手市场.svg' },
      { key: 'errand', label: '跑腿', icon: '/images/SVG/跑腿.svg' },
      { key: 'rating', label: '评分', icon: '/images/SVG/评分.svg' }
    ],

    /* 数据 */
    userInfo: {},
    schoolInfo: {},
    /* 当前浏览学校 id，空表示本校 */
    browsingCampusId: '',
    feedList: [],
    marketList: [],
    errandList: [],
    errandPage: 1,
    errandHasMore: true,
    errandLoading: false,
    errandSubTab: 'demand',
    supplyList: [],
    supplyPage: 1,
    supplyHasMore: true,
    supplyLoading: false,

    /* 二手二级分类 */
    marketSubTabs: [
      { key: 'book', label: '书籍资料' },
      { key: 'other', label: '其他' }
    ],

    teacherRatingList: [],
    teacherLoading: false,
    teacherRefreshing: false,
    expandedTeacherId: null,

    /* 帖子 / 跑腿 刷新状态 */
    feedRefreshing: false,
    errandRefreshing: false,

    /* 当前列表引用（用于空状态判断） */
    currentList: [],

    /* scroll-view 回顶控制 */
    _scrollTop: 0,

    /* 二手书分类标签 */
    bookCategories: [
      { key: 'all', label: '推荐' },
      { key: '教材教辅', label: '教材教辅' },
      { key: '考研考证', label: '考研考证' },
      { key: '文学小说', label: '文学小说' },
      { key: '专业教材', label: '专业教材' },
      { key: '四六级', label: '四六级' },
      { key: '计算机', label: '计算机' },
      { key: '考研政治', label: '考研政治' },
      { key: '其他书籍', label: '其他书籍' }
    ],
    currentBookCategory: 'all',
    bookList: [],
    filteredBookList: [],
    bookDisplayList: [],
    bookSearchKeyword: '',
    bookRefreshing: false,
    bookHasMore: true,
    bookPage: 1,
    bookPageSize: 10,

    /* 二手-其他瀑布流 */
    otherList: [],
    otherDisplayList: [],
    otherSearchKeyword: '',
    otherCategories: [
      { key: 'all', label: '推荐' },
      { key: '数码', label: '数码' },
      { key: '其他闲置', label: '其他闲置' }
    ],
    otherCurrentCategory: 'all',
    otherRefreshing: false,
    otherHasMore: true,
    otherPage: 1,
    otherPageSize: 10,
    otherServerPage: 1,
    otherServerHasMore: true,
    otherLoading: false,

    /* 关注视图数据 */
    followingUsers: [],
    followingPosts: [],
    selectedFollowUid: '',
    followingUsersLoaded: false,
    /* 关注用户头像栏：游标分页 */
    followingCursor: null,
    followingHasMore: true,
    followingLoading: false,
    /* 关注动态：游标分页 */
    _followScrollTop: 0,
    _followRefreshing: false,
    _followHasMore: true,
    _followCursor: null,
    /* 关注动态 swiper：横向切换用户（index 0 = 全部动态） */
    followUserIndex: 0,
    followFeedLists: [{ uid: '', posts: [] }]
  },

  onLoad() {
    /* 计算自定义导航栏尺寸，与胶囊按钮对齐 */
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    const navBarRight = systemInfo.windowWidth - menuButton.left + 12

    const userInfo = app.globalData.userInfo || {}
    const currentUid = userInfo.uid

    // 替换当前用户帖子的头像昵称
    const replaceUserInfo = (list) => {
      return list.map(item => {
        if (item.user && item.user.uid === currentUid) {
          return {
            ...item,
            user: {
              ...item.user,
              name: userInfo.nickname || item.user.name,
              avatar: userInfo.avatar || item.user.avatar
            }
          }
        }
        return item
      })
    }

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      navBarRight: navBarRight,
      isLoggedIn: app.globalData.isLoggedIn,
      isJoinedSchool: app.globalData.isJoinedSchool,
      userInfo: userInfo,
      schoolInfo: Object.assign({}, mock.schools[6], { icon: '/images/avatars/default.png' }),
      feedList: replaceUserInfo([]),
      marketList: [],
      errandList: [],
      currentList: replaceUserInfo([]),
      marketBookList: [],
      marketOtherList: [],
      otherList: [],
      followingUsers: [],
      followingPosts: [],
      followingUsersLoaded: false,
      bookList: [],
      filteredBookList: [],
      bookDisplayList: [],
      bookHasMore: true,
      bookLoading: false,
      bookServerPage: 1,
      bookServerHasMore: true
    })
    this.loadFeed()
    if (canAccessCampusFeatures()) this.loadCampusData()
  },

  /** 仅在用户已完成校园资料后加载按学校隔离的数据。 */
  loadCampusData() {
    if (!canAccessCampusFeatures()) return Promise.resolve()
    return Promise.all([
      this.loadErrands(),
      this.loadIdleBooks(1, true),
      this.loadIdleItems(1, true)
    ])
  },

  /** 浏览其他学校时附加的查询参数（空=本校） */
  getBrowseParams() {
    const campusId = this.data.browsingCampusId
    return campusId ? { campusId } : {}
  },

  loadFeed() {
    // 读取本地点赞记录，合并到 feed 数据中（feed API 不返回 liked 字段）
    const likedIds = readObjectStorage('likedPostIds')
    const browsingCampusId = this.data.browsingCampusId
    const reqOptions = browsingCampusId
      ? { url: '/api/post/list', method: 'GET', data: { targetCampusId: browsingCampusId, pageSize: 20 } }
      : { url: '/api/post/feed', method: 'GET', data: { pageSize: 20 } }
    return request(reqOptions).then(data => {
      try {
        console.log('feed API 返回:', JSON.stringify(data))
        if (!data || !Array.isArray(data.list)) {
          throw new Error('帖子接口返回格式不正确')
        }
        const list = data.list.map(vo => {
          vo = vo && typeof vo === 'object' ? vo : {}
          // 兼容多种日期格式：字符串 或 数组 [year,month,day,hour,min,sec]
          let timeStr = ''
          if (vo.createdAt) {
            if (Array.isArray(vo.createdAt)) {
              const [y, m, d, h, mi] = vo.createdAt
              timeStr = `${y}-${pad2(m)}-${pad2(d)} ${pad2(h)}:${pad2(mi)}`
            } else if (typeof vo.createdAt === 'string') {
              timeStr = vo.createdAt.replace('T', ' ').slice(0, 16)
            }
          }
          return {
            id: vo.id,
            user: { uid: String(vo.userId || ''), name: vo.nickname || '', avatar: toFullUrl(vo.avatarUrl) || '' },
            title: vo.title || '',
            content: vo.content || '',
            images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
            stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
            liked: vo.liked || !!likedIds[vo.id],
            time: timeStr,
            school: vo.schoolName || '',
            sourceType: vo.sourceType || '',
            sourceId: vo.sourceId || ''
          }
        })
        this.setData({ feedList: list, currentList: list })
        wx.removeStorageSync('lastFeedRenderError')
        return true
      } catch (err) {
        const message = getErrorMessage(err)
        console.error('处理帖子数据失败:', err)
        wx.setStorageSync('lastFeedRenderError', message)
        wx.showToast({ title: '帖子数据处理失败：' + message, icon: 'none', duration: 3500 })
        return false
      }
    }, err => {
      console.error('帖子接口请求失败:', err)
      wx.showToast({ title: '帖子网络请求失败，请下拉刷新', icon: 'none', duration: 2000 })
      return false
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    const previouslyJoined = this.data.isJoinedSchool
    const isJoinedSchool = canAccessCampusFeatures()
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      isJoinedSchool
    })

    // 完善资料后 switchTab 回到已存在的首页实例，onLoad 不会重跑，需在这里补加载校园数据。
    if (!previouslyJoined && isJoinedSchool) this.loadCampusData()

    /* 检查是否从选校页面返回了新学校 */
    const selectedSchool = wx.getStorageSync('selectedSchool')
    if (selectedSchool) {
      // 兼容 JSON 字符串（{"id":2,"name":"上海大学"}）和纯名字字符串（老数据）
      let schoolName = ''
      let schoolId = ''
      if (typeof selectedSchool === 'object') {
        schoolName = selectedSchool.name || ''
        schoolId = selectedSchool.id || ''
      } else {
        try {
          const parsed = JSON.parse(selectedSchool)
          schoolName = (parsed && parsed.name) || ''
          schoolId = (parsed && parsed.id) || ''
        } catch (e) {
          schoolName = selectedSchool
        }
      }
      if (schoolName && schoolName !== this.data.schoolInfo.name) {
        // 优先在 mock.schools 按 name 匹配补齐展示字段；匹配不到（后端新建学校）直接用解析出的 id/name
        const school = mock.schools.find(s => s.name === schoolName)
        const schoolInfo = school
          ? Object.assign({}, school, { icon: '/images/avatars/default.png' })
          : { id: schoolId, name: schoolName, icon: '/images/avatars/default.png' }
        this.setData({ schoolInfo, browsingCampusId: schoolId })
        this.loadFeed()
        // 切换学校后完整重载其余按学校隔离的数据
        this.loadCampusData()
        this.loadTeacherRatings()
        this.loadSupplies(1)
      }
    }

    // 同步详情页的点赞/取消赞操作到列表
    this._syncPostLikeUpdate()
  },

  /* 加载教师评分（真实 API） */
  loadTeacherRatings() {
    if (!canAccessCampusFeatures()) {
      this.setData({ teacherLoading: false })
      return Promise.resolve()
    }
    this.setData({ teacherLoading: true })
    return request({
      url: '/api/v1/teacher/search',
      method: 'GET',
      data: Object.assign({ pageSize: 10 }, this.getBrowseParams())
    }).then(data => {
      const list = (data && data.list) ? data.list : []
      const cards = list.map(t => ({
        id: t.id,
        name: t.name,
        avgScore: t.avgScore,
        ratingCount: t.ratingCount || 0,
        courses: (t.courses || []).map(c => ({
          id: c.id,
          courseName: c.courseName,
          avgScore: c.avgScore,
          ratingCount: c.ratingCount || 0
        }))
      }))
      this.setData({ teacherRatingList: cards, teacherLoading: false })
    }).catch(err => {
      console.error('加载教师评分失败:', err)
      this.setData({ teacherLoading: false })
    })
  },

  /* 根据当前 Tab 获取列表数据 */
  getCurrentList(tab) {
    switch (tab) {
      case 'feed': return this.data.feedList
      case 'market': return this.getMarketList()
      case 'errand': return this.data.errandList
      default: return this.data.feedList
    }
  },

  /* 获取二手列表（按二级分类过滤） */
  getMarketList() {
    const { marketList, marketSubTab } = this.data
    if (marketSubTab === 'book') {
      return marketList.filter(item => item.tag === '二手书')
    }
    return marketList.filter(item => item.tag !== '二手书')
  },


  goToLogin() {
    safeNavigate({ url: '/pages/login/login' })
  },

  /* 切换推荐/关注 */
  switchFeedType(e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.feedType) return
    if (type === 'follow' && !requireAuth()) return
    const index = type === 'recommend' ? 0 : 1
    this.setData({
      feedSwiperIndex: index,
      feedType: type,
      feedIndicatorRatio: index === 0 ? 0.25 : 0.75
    })
    if (type === 'follow') {
      // 首次进入关注 tab 时加载数据
      if (!this.data.followingUsersLoaded) {
        this.loadFollowingUsers()
      }
      if (this.data.followingPosts.length === 0) {
        this.loadFollowingPosts()
      }
      this.setData({
        _followScrollTop: this.data._followScrollTop ? 0 : 1
      })
    }
  },

  /* swiper 滑动切换 */
  onFeedSwiperChange(e) {
    const index = e.detail.current
    const type = index === 0 ? 'recommend' : 'follow'
    if (type === this.data.feedType) return
    if (type === 'follow' && !requireAuth()) {
      this.setData({ feedSwiperIndex: 0, feedType: 'recommend', feedIndicatorRatio: 0.25 })
      return
    }
    this.setData({
      feedType: type,
      feedSwiperIndex: index,
      feedIndicatorRatio: index === 0 ? 0.25 : 0.75
    })
    if (type === 'follow') {
      if (!this.data.followingUsersLoaded) {
        this.loadFollowingUsers()
      }
      if (this.data.followingPosts.length === 0) {
        this.loadFollowingPosts()
      }
    }
  },

  /* 切换主 Tab（分类方块） */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab !== 'feed' && !requireAuth()) return
    const map = { feed: 0, market: 1, errand: 3, rating: 4 }
    const index = map[tab] || 0
    this.setData({
      currentTab: tab,
      innerSwiperIndex: index,
      marketSubTab: tab === 'market' ? 'book' : this.data.marketSubTab,
      marketIndicatorRatio: tab === 'market' ? 0.25 : this.data.marketIndicatorRatio
    })
    if (tab === 'rating') {
      this.loadTeacherRatings()
    }
  },

  /* 内层 swiper 滑动切换 */
  onInnerSwiperChange(e) {
    const index = e.detail.current
    const tabMap = { 0: 'feed', 1: 'market', 2: 'market', 3: 'errand', 4: 'rating' }
    const tab = tabMap[index] || 'feed'
    if (tab !== 'feed' && !requireAuth()) {
      this.setData({ innerSwiperIndex: 0, currentTab: 'feed' })
      return
    }
    const subTab = index === 1 ? 'book' : (index === 2 ? 'other' : this.data.marketSubTab)
    this.setData({
      innerSwiperIndex: index,
      currentTab: tab,
      marketSubTab: subTab,
      marketIndicatorRatio: subTab === 'book' ? 0.25 : 0.75
    })
    if (tab === 'rating') {
      this.loadTeacherRatings()
    }
  },

  /* 切换二手二级分类 */
  switchMarketSubTab(e) {
    const key = e.currentTarget.dataset.key
    const index = key === 'book' ? 1 : 2
    this.setData({
      marketSubTab: key,
      marketIndicatorRatio: key === 'book' ? 0.25 : 0.75,
      innerSwiperIndex: index,
      currentList: this.getMarketList()
    })
  },

  /* 展开/收起教师课程列表 */
  toggleTeacherExpand(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      expandedTeacherId: this.data.expandedTeacherId === id ? null : id
    })
  },

  /* 点击课程跳转至课程评价详情 */
  goToCourseRating(e) {
    const { teacherId, teacherName, teacherAvgscore, courseId, courseName, courseAvgscore } = e.currentTarget.dataset
    safeNavigate({
      url: `/pages/teacher-ratings/teacher-ratings?teacherId=${teacherId}&teacherName=${encodeURIComponent(teacherName)}&teacherAvgScore=${encodeURIComponent(teacherAvgscore || '')}&courseId=${courseId}&courseName=${encodeURIComponent(courseName)}&courseAvgScore=${encodeURIComponent(courseAvgscore || '')}`
    })
  },

  /* 切换学校 */
  switchSchool() {
    safeNavigate({ url: '/pages/select-school/select-school' })
  },

  /* 跳转搜索 */
  requireLogin() {
    return requireAuth()
  },

  /* 跳转搜索 */
  goToSearch() {
    safeNavigate({ url: '/pages/search/search' })
  },

  /* 跳转私信 */
  goToInbox() {
    safeSwitch({ url: '/pages/inbox/inbox' })
  },

  /* 跳转发布 */
  goToPublish() {
    safeNavigate({ url: '/pages/publish-post/publish-post' })
  },

  /* 跳转帖子详情 */
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    // 将当前帖子状态（含乐观更新的点赞）传递给详情页
    const post = this.data.feedList.find(item => String(item.id) === String(id))
      || this.data.followingPosts.find(item => String(item.id) === String(id))
    if (post) {
      wx.setStorageSync('selectedPostDetail', post)
    }
    safeNavigate({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  /* 列表点赞/取消赞（乐观更新） */
  toggleFeedLike(e) {
    if (!this.requireLogin()) return
    const { id, index, list } = e.currentTarget.dataset
    const listKey = list || 'feedList'
    const dataList = this.data[listKey]
    if (!dataList || index === undefined || index >= dataList.length) return
    const item = dataList[index]
    if (String(item.id) !== String(id)) return

    const isLiked = item.liked
    const newLiked = !isLiked
    const newLikes = Math.max(0, (item.stats.likes || 0) + (newLiked ? 1 : -1))
    const apiUrl = isLiked ? '/api/post/unlike/' + id : '/api/post/like/' + id

    // 乐观更新
    this.setData({
      [listKey + '[' + index + '].liked']: newLiked,
      [listKey + '[' + index + '].stats.likes']: newLikes
    })

    request({ url: apiUrl, method: 'POST' }).then(() => {
      // 持久化点赞状态到本地，解决 feed API 不返回 liked 字段的问题
      const likedIds = wx.getStorageSync('likedPostIds') || {}
      if (newLiked) {
        likedIds[id] = true
      } else {
        delete likedIds[id]
      }
      wx.setStorageSync('likedPostIds', likedIds)
    }).catch(err => {
      console.error('[toggleFeedLike] 请求失败:', JSON.stringify(err))
      // 回滚
      this.setData({
        [listKey + '[' + index + '].liked']: isLiked,
        [listKey + '[' + index + '].stats.likes']: item.stats.likes
      })
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none', duration: 2000 })
    })
  },

  /* 跳转跑腿详情 */
  goToErrandDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.errandList.find(i => i.id === id)
    if (item) {
      wx.setStorageSync('currentErrand', item)
      safeNavigate({ url: `/pages/errand-detail/errand-detail?id=${id}` })
    }
  },

  /* 跳转供给详情（复用跑腿详情页） */
  goToSupplyDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.supplyList.find(i => i.id === id)
    if (item) {
      wx.setStorageSync('currentErrand', item)
      safeNavigate({ url: `/pages/errand-detail/errand-detail?id=${id}&type=supply` })
    }
  },

  /* 联系跑腿用户 */
  contactErrandUser(e) {
    const { name, avatar, userId } = e.currentTarget.dataset
    safeNavigate({ url: `/pages/chat/chat?userId=${userId || ''}&name=${name}&avatar=${encodeURIComponent(avatar)}` })
  },

  /* 抢单 */
  grabErrand(e) {
    if (!this.requireLogin()) return
    const id = e.currentTarget.dataset.id
    const item = this.data.errandList.find(i => i.id === id)
    if (item) {
      wx.showToast({ title: '抢单成功', icon: 'success' })
    }
  },

  /* 跳转集市详情 */
  goToMarketDetail(e) {
    const id = e.currentTarget.dataset.id
    safeNavigate({ url: `/pages/market-detail/market-detail?id=${id}` })
  },

  /* 双击 tab 回到顶部 */
  scrollToTop() {
    this.setData({ _scrollTop: this.data._scrollTop ? 0 : 1 })
  },

  /* ========== 下拉刷新方法 ========== */

  refreshFeed() {
    this.setData({ feedRefreshing: true })
    this.loadFeed().finally(() => {
      this.setData({ feedRefreshing: false })
      wx.showToast({ title: '刷新成功', icon: 'none' })
    })
  },

  /* 加载跑腿（代课需求）列表 */
  loadErrands(pageNum = 1) {
    if (!canAccessCampusFeatures()) {
      this.setData({ errandLoading: false })
      return Promise.resolve()
    }
    if (this.data.errandLoading) return Promise.resolve()
    this.setData({ errandLoading: true })
    return request({
      url: '/api/v1/proxy-class-demand/list',
      method: 'GET',
      data: Object.assign({ pageNum, pageSize: 10 }, this.getBrowseParams())
    }).then(data => {
      const list = (data.list || []).map(vo => this.mapErrandItem(vo))
      const errandList = pageNum === 1 ? list : [...this.data.errandList, ...list]
      this.setData({
        errandList,
        errandPage: pageNum,
        errandHasMore: data.list && data.list.length >= 10,
        errandLoading: false
      })
    }).catch(err => {
      console.error('加载跑腿列表失败:', err)
      this.setData({ errandLoading: false })
      if (pageNum === 1) {
        wx.showToast({ title: '加载跑腿任务失败，请下拉刷新', icon: 'none', duration: 2000 })
      }
    })
  },

  /* 将代课需求 VO 映射为跑腿卡片格式 */
  mapErrandItem(vo) {
    let timeStr = ''
    if (vo.createdAt) {
      if (Array.isArray(vo.createdAt)) {
        const [y, m, d, h, mi] = vo.createdAt
        timeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
      } else if (typeof vo.createdAt === 'string') {
        timeStr = vo.createdAt.replace('T', ' ').slice(0, 16)
      }
    }

    // 构建内容描述：上课地点 + 备注
    const locationParts = []
    if (vo.locationCampus) locationParts.push(vo.locationCampus)
    if (vo.locationBuilding) locationParts.push(vo.locationBuilding)
    if (vo.locationRoom) locationParts.push(vo.locationRoom)
    const locationStr = locationParts.length > 0 ? locationParts.join(' ') : ''

    // 格式化上课时间
    let classTimeStr = ''
    if (vo.classTime) {
      if (Array.isArray(vo.classTime)) {
        const [y, m, d, h, mi] = vo.classTime
        classTimeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
      } else if (typeof vo.classTime === 'string') {
        classTimeStr = vo.classTime.replace('T', ' ').slice(0, 16)
      }
    }

    const contentParts = []
    if (locationStr) contentParts.push(locationStr)
    if (classTimeStr) contentParts.push(classTimeStr)
    if (vo.remark) contentParts.push(vo.remark)

    // 提取上课时间 HH:MM 用于显示
    let classTimeShort = ''
    if (classTimeStr) {
      const timeMatch = classTimeStr.match(/(\d{2}:\d{2})$/)
      if (timeMatch) classTimeShort = timeMatch[1]
    }

    // 计算距开始时间还剩多久
    let countdown = ''
    if (vo.classTime) {
      let classDate = null
      if (Array.isArray(vo.classTime)) {
        const [y, m, d, h, mi] = vo.classTime
        classDate = new Date(y, m - 1, d, h || 0, mi || 0)
      } else if (typeof vo.classTime === 'string') {
        classDate = new Date(vo.classTime.replace(' ', 'T'))
      }
      if (classDate) {
        const now = new Date()
        const diff = classDate.getTime() - now.getTime()
        if (diff > 0) {
          const minutes = Math.floor(diff / 60000)
          const hours = Math.floor(minutes / 60)
          const days = Math.floor(hours / 24)
          let timePart = ''
          if (days > 0) {
            timePart = `${days}天${hours % 24}小时`
          } else if (hours > 0) {
            timePart = `${hours}小时${minutes % 60}分钟`
          } else {
            timePart = `${minutes}分钟`
          }
          countdown = `距开始还剩 ${timePart}`
        }
      }
    }

    return {
      id: vo.id,
      type: 'errand',
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || ''
      },
      title: vo.courseName || '',
      content: contentParts.length > 0 ? contentParts.join('\n') : (vo.courseName || ''),
      location: locationStr,
      classTime: classTimeStr,
      remark: vo.remark || '',
      reward: vo.fee != null ? Number(vo.fee) : 0,
      time: timeStr,
      status: 'available',
      school: '',
      countdown,
      _raw: {
        onlySameSchool: vo.onlySameSchool
      }
    }
  },

  /* 加载更多跑腿 */
  loadMoreErrands() {
    if (this.data.errandSubTab === 'demand') {
      if (!this.data.errandHasMore || this.data.errandLoading) return
      this.loadErrands(this.data.errandPage + 1)
    } else {
      if (!this.data.supplyHasMore || this.data.supplyLoading) return
      this.loadSupplies(this.data.supplyPage + 1)
    }
  },

  refreshErrands() {
    this.setData({ errandRefreshing: true })
    if (this.data.errandSubTab === 'demand') {
      this.loadErrands(1).finally(() => {
        this.setData({ errandRefreshing: false })
      })
    } else {
      this.loadSupplies(1).finally(() => {
        this.setData({ errandRefreshing: false })
      })
    }
  },

  /* 切换跑腿子 tab：需求 / 供给 */
  switchErrandSubTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.errandSubTab) return
    this.setData({ errandSubTab: tab })
    if (tab === 'supply' && this.data.supplyList.length === 0) {
      this.loadSupplies(1)
    }
  },

  /* 加载代课供给列表 */
  loadSupplies(pageNum = 1) {
    if (!canAccessCampusFeatures()) {
      this.setData({ supplyLoading: false })
      return Promise.resolve()
    }
    if (this.data.supplyLoading) return Promise.resolve()
    this.setData({ supplyLoading: true })
    return request({
      url: '/api/v1/proxy-class-supply/list',
      method: 'GET',
      data: Object.assign({ pageNum, pageSize: 10 }, this.getBrowseParams())
    }).then(data => {
      const list = (data.list || []).map(vo => this.mapSupplyItem(vo))
      const supplyList = pageNum === 1 ? list : [...this.data.supplyList, ...list]
      this.setData({
        supplyList,
        supplyPage: pageNum,
        supplyHasMore: data.list && data.list.length >= 10,
        supplyLoading: false
      })
    }).catch(err => {
      console.error('加载代课供给列表失败:', err)
      this.setData({ supplyLoading: false })
      if (pageNum === 1) {
        wx.showToast({ title: '加载代课供给失败，请下拉刷新', icon: 'none', duration: 2000 })
      }
    })
  },

  /* 将代课供给 VO 映射为卡片格式 */
  mapSupplyItem(vo) {
    let timeStr = ''
    if (vo.createdAt) {
      if (Array.isArray(vo.createdAt)) {
        const [y, m, d, h, mi] = vo.createdAt
        timeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
      } else if (typeof vo.createdAt === 'string') {
        timeStr = vo.createdAt.replace('T', ' ').slice(0, 16)
      }
    }

    return {
      id: vo.id,
      type: 'supply',
      user: {
        uid: String(vo.userId || ''),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || ''
      },
      title: vo.subjectRange || '',
      content: vo.availableTime || '',
      location: '',
      classTime: vo.availableTime || '',
      remark: '',
      reward: vo.expectedFee != null ? Number(vo.expectedFee) : 0,
      time: timeStr,
      status: 'available',
      school: '',
      countdown: '',
      _raw: {}
    }
  },

  refreshTeacherRatings() {
    this.setData({ teacherRefreshing: true })
    this.loadTeacherRatings().finally(() => {
      this.setData({ teacherRefreshing: false })
      wx.showToast({ title: '刷新成功', icon: 'none' })
    })
  },

  /* 点击底部首页 tab 时刷新当前 tab */
  refreshCurrentTab() {
    const { currentTab, feedType, marketSubTab } = this.data
    if (feedType === 'follow') {
      this.refreshFollowing()
      return
    }
    switch (currentTab) {
      case 'feed':
        this.refreshFeed()
        break
      case 'market':
        if (marketSubTab === 'book') {
          this.refreshBookList()
        } else {
          this.refreshOtherList()
        }
        break
      case 'errand':
        this.refreshErrands()
        break
      case 'rating':
        this.refreshTeacherRatings()
        break
    }
  },

  /* ========== 二手书市场方法 ========== */

  filterBookList() {
    const { bookList, currentBookCategory, bookSearchKeyword, bookPage, bookPageSize } = this.data
    let result = [...bookList]
    if (currentBookCategory !== 'all') {
      result = result.filter(item => item.category === currentBookCategory)
    }
    if (bookSearchKeyword.trim()) {
      const kw = bookSearchKeyword.trim().toLowerCase()
      result = result.filter(item =>
        (item.title || '').toLowerCase().includes(kw) ||
        ((item.seller && item.seller.school) || '').toLowerCase().includes(kw) ||
        ((item.seller && item.seller.major) || '').toLowerCase().includes(kw)
      )
    }
    const displayList = result.slice(0, bookPage * bookPageSize)
    this.setData({
      filteredBookList: result,
      bookDisplayList: displayList,
      bookHasMore: result.length > displayList.length
    })
  },

  switchBookCategory(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.currentBookCategory) return
    this.setData({
      currentBookCategory: key,
      bookPage: 1,
      bookList: []
    })
    this.loadIdleBooks(1, true)
  },

  onBookSearchInput(e) {
    this.setData({ bookSearchKeyword: e.detail.value })
  },

  onBookSearchConfirm() {
    this.setData({ bookPage: 1, bookList: [] })
    this.loadIdleBooks(1, true)
  },

  onBookSearchClear() {
    this.setData({ bookSearchKeyword: '', bookPage: 1, bookList: [] })
    this.loadIdleBooks(1, true)
  },

  toggleBookFavorite(e) {
    if (!this.requireLogin()) return
    const id = e.currentTarget.dataset.id
    const target = this.data.filteredBookList.find(item => item.id === id)
    if (!target) return
    const oldFav = target.isFavorite
    const newFav = !oldFav
    // 乐观更新：先切换本地状态，失败时回滚
    const applyFav = (fav) => {
      const list = this.data.filteredBookList.map(item =>
        item.id === id ? { ...item, isFavorite: fav } : item
      )
      const displayList = list.slice(0, this.data.bookPage * this.data.bookPageSize)
      this.setData({ filteredBookList: list, bookDisplayList: displayList })
    }
    applyFav(newFav)
    // 调用收藏 API
    request({
      url: '/api/v1/favorite/toggle',
      method: 'POST',
      data: { targetId: id, targetType: 2 }
    }).then(() => {
      wx.showToast({
        title: newFav ? '已收藏' : '已取消收藏',
        icon: 'none'
      })
    }).catch(() => {
      applyFav(oldFav)
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  refreshBookList() {
    this.setData({ bookRefreshing: true })
    this.loadIdleBooks(1, true).finally(() => {
      this.setData({ bookRefreshing: false })
    })
  },

  loadMoreBooks() {
    if (!this.data.bookServerHasMore || this.data.bookLoading) return
    this.loadIdleBooks(this.data.bookServerPage + 1, false)
  },

  goToBookDetail(e) {
    const id = e.currentTarget.dataset.id
    safeNavigate({ url: `/pages/market-detail/market-detail?id=${id}` })
  },

  /* ========== 关注视图方法 ========== */

  /** 加载关注用户列表（来自 /api/v1/follow/following，游标滚动查询） */
  loadFollowingUsers(cursor) {
    if (!canAccessCampusFeatures()) return Promise.resolve()
    if (this.data.followingLoading) return Promise.resolve()
    this.setData({ followingLoading: true })
    const data = { size: 20 }
    if (cursor) data.cursor = cursor
    return request({
      url: '/api/v1/follow/following',
      data
    }).then(result => {
      const users = (result.list || []).map(vo => ({
        uid: String(vo.userId),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '',
        campusName: vo.campusName || '',
        hasNew: false
      }))
      const followingUsers = cursor ? this.data.followingUsers.concat(users) : users
      this.setData({
        followingUsers,
        followingCursor: result.nextCursor || null,
        followingHasMore: result.hasMore !== false,
        followingUsersLoaded: true,
        followingLoading: false
      })
      this._sortFollowingUsersByLatestPost()
    }).catch(err => {
      console.error('加载关注用户失败:', err)
      this.setData({ followingUsersLoaded: true, followingLoading: false })
    })
  },

  /** 加载更多关注用户（头像栏横向滚动到底部时触发） */
  loadMoreFollowingUsers() {
    if (!this.data.followingHasMore || this.data.followingLoading) return
    this.loadFollowingUsers(this.data.followingCursor)
  },

  /** 加载关注动态（只显示关注用户发布的帖子） */
  loadFollowingPosts(cursor) {
    if (!canAccessCampusFeatures()) {
      this.setData({ _followRefreshing: false })
      return Promise.resolve()
    }
    this.setData({ _followRefreshing: true })
    const data = { pageSize: 20 }
    if (cursor) data.cursor = cursor
    return request({ url: '/api/post/following-feed', data }).then(result => {
      const list = (result.list || []).map(vo => this._mapFeedItem(vo))
      const posts = cursor
        ? this.data.followingPosts.concat(list)
        : list
      this.setData({
        followingPosts: posts,
        _followCursor: result.nextCursor || null,
        _followHasMore: result.hasMore || false,
        _followRefreshing: false
      })
      this._buildFollowFeedLists()
      // 首次加载（非分页）后按最新发帖时间重排头像
      if (!cursor) this._sortFollowingUsersByLatestPost()
    }).catch(err => {
      console.error('加载关注动态失败:', err)
      this.setData({ _followRefreshing: false })
    })
  },

  /** 将 feed API 返回的 PostListVO 映射为前端展示格式 */
  _mapFeedItem(vo) {
    const likedIds = wx.getStorageSync('likedPostIds') || {}
    let timeStr = ''
    let ts = 0
    if (vo.createdAt) {
      if (Array.isArray(vo.createdAt)) {
        const [y, m, d, h, mi, s] = vo.createdAt
        timeStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h || 0).padStart(2, '0')}:${String(mi || 0).padStart(2, '0')}`
        ts = new Date(y, m - 1, d, h || 0, mi || 0, s || 0).getTime()
      } else if (typeof vo.createdAt === 'string') {
        timeStr = vo.createdAt.replace('T', ' ').slice(0, 16)
        ts = new Date(vo.createdAt.replace(' ', 'T')).getTime() || 0
      }
    }
    return {
      id: vo.id,
      user: { uid: String(vo.userId || ''), name: vo.nickname || '', avatar: toFullUrl(vo.avatarUrl) || '' },
      title: vo.title || '',
      content: vo.content || '',
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      stats: { likes: vo.likeCount || 0, comments: vo.commentCount || 0 },
      liked: vo.liked || !!likedIds[vo.id],
      time: timeStr,
      _ts: ts,
      school: vo.schoolName || '',
      sourceType: vo.sourceType || '',
      sourceId: vo.sourceId || ''
    }
  },

  refreshFollowing() {
    Promise.all([
      this.loadFollowingPosts(),
      this.loadFollowingUsers()
    ]).finally(() => {
      wx.showToast({ title: '刷新成功', icon: 'none' })
    })
  },

  loadMoreFollowing() {
    if (!this.data._followHasMore) return
    this.loadFollowingPosts(this.data._followCursor)
  },

  /** 点击关注用户头像：切换到该用户（再次点击回到「全部」） */
  filterByFollowUser(e) {
    const { uid } = e.currentTarget.dataset
    const newSelectedUid = this.data.selectedFollowUid === uid ? '' : uid
    this._setFollowUser(newSelectedUid)
  },

  /** 切换到指定关注用户（uid 为空 = 全部动态），同步 swiper 与头像栏选中态 */
  _setFollowUser(uid) {
    const selectedFollowUid = uid || ''
    const { followFeedLists } = this.data
    let idx = 0
    if (selectedFollowUid) {
      const i = followFeedLists.findIndex(l => l.uid === String(selectedFollowUid))
      if (i > 0) idx = i
    }
    this.setData({ selectedFollowUid, followUserIndex: idx })
  },

  /** 横向滑动 swiper 切换用户时同步选中头像 */
  onFollowUserSwiperChange(e) {
    const lists = this.data.followFeedLists
    if (!lists.length) return
    const idx = e.detail.current
    const safeIdx = idx < 0 ? 0 : (idx >= lists.length ? lists.length - 1 : idx)
    const list = lists[safeIdx]
    this.setData({ selectedFollowUid: list.uid || '', followUserIndex: safeIdx })
  },

  /** 关注页点赞/取消赞（乐观更新） */
  toggleFollowFeedLike(e) {
    if (!this.requireLogin()) return
    const { id } = e.currentTarget.dataset
    const idx = this.data.followingPosts.findIndex(item => String(item.id) === String(id))
    if (idx < 0) return
    const item = this.data.followingPosts[idx]
    const isLiked = item.liked
    const newLiked = !isLiked
    const newLikes = Math.max(0, (item.stats.likes || 0) + (newLiked ? 1 : -1))
    const apiUrl = isLiked ? '/api/post/unlike/' + id : '/api/post/like/' + id

    this.setData({
      ['followingPosts[' + idx + '].liked']: newLiked,
      ['followingPosts[' + idx + '].stats.likes']: newLikes
    })
    this._buildFollowFeedLists()

    request({ url: apiUrl, method: 'POST' }).then(() => {
      const likedIds = wx.getStorageSync('likedPostIds') || {}
      if (newLiked) likedIds[id] = true
      else delete likedIds[id]
      wx.setStorageSync('likedPostIds', likedIds)
    }).catch(err => {
      console.error('[toggleFollowFeedLike] 请求失败:', JSON.stringify(err))
      this.setData({
        ['followingPosts[' + idx + '].liked']: isLiked,
        ['followingPosts[' + idx + '].stats.likes']: item.stats.likes
      })
      this._buildFollowFeedLists()
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none', duration: 2000 })
    })
  },

  /** 根据 followingUsers + followingPosts 重建 swiper 页数据（index 0 = 全部动态） */
  _buildFollowFeedLists() {
    const { followingUsers, followingPosts, selectedFollowUid } = this.data
    const lists = [{ key: 'all', uid: '', posts: followingPosts }]
    followingUsers.forEach(u => {
      const uid = String(u.uid)
      lists.push({
        key: 'u-' + uid,
        uid,
        posts: followingPosts.filter(p => p.user && String(p.user.uid) === uid)
      })
    })
    let idx = 0
    if (selectedFollowUid) {
      const i = lists.findIndex(l => l.uid === String(selectedFollowUid))
      if (i > 0) idx = i
    }
    this.setData({ followFeedLists: lists, followUserIndex: idx })
  },

  /** 按最新发帖时间降序重排关注用户头像（无帖子的用户排到最后，保持原相对顺序） */
  _sortFollowingUsersByLatestPost() {
    const { followingUsers, followingPosts } = this.data
    if (!followingUsers.length) return
    // 计算每个关注用户的最新发帖时间戳
    const latestTs = {}
    followingPosts.forEach(p => {
      if (p.user && p.user.uid && p._ts) {
        const uid = String(p.user.uid)
        if (!latestTs[uid] || p._ts > latestTs[uid]) latestTs[uid] = p._ts
      }
    })
    const sorted = followingUsers
      .map((u, i) => ({ u, i, ts: latestTs[String(u.uid)] }))
      .sort((a, b) => {
        const ta = a.ts
        const tb = b.ts
        if (ta != null && tb != null) return tb - ta
        if (ta != null) return -1
        if (tb != null) return 1
        return a.i - b.i
      })
      .map(x => x.u)
    this.setData({ followingUsers: sorted })
    // 头像顺序变化后，重建 swiper 页使其顺序一致
    this._buildFollowFeedLists()
  },

  goToUserProfile(e) {
    const { uid, name, avatar } = e.currentTarget.dataset
    const currentUid = (app.globalData.userInfo || {}).uid
    if (uid && String(uid) === String(currentUid)) {
      safeSwitch({ url: '/pages/profile/profile' })
      return
    }
    safeNavigate({
      url: `/pages/user-home/user-home?userId=${uid || ''}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`
    })
  },

  /* 同步详情页点赞操作到列表 */
  _syncPostLikeUpdate() {
    const update = wx.getStorageSync('postLikeUpdate')
    if (!update || !update.id) return
    wx.removeStorageSync('postLikeUpdate')

    const applyUpdate = (listKey) => {
      const list = this.data[listKey]
      if (!list) return false
      const idx = list.findIndex(item => String(item.id) === String(update.id))
      if (idx < 0) return false
      this.setData({
        [listKey + '[' + idx + '].liked']: update.liked,
        [listKey + '[' + idx + '].stats.likes']: update.likeCount
      })
      return true
    }

    applyUpdate('feedList') || applyUpdate('followingPosts') || applyUpdate('errandList')
  },

  /* 阻止内容区域 touchmove 冒泡到 swiper */
  preventSwipe() {
    // 空函数，catchtouchmove 阻止事件冒泡
  },

  /* ========== 二手-其他瀑布流方法 ========== */

  transformToOtherCard(list) {
    return list.map(item => ({
      id: item.id,
      title: item.title,
      price: item.price,
      originalPrice: item.originalPrice,
      images: item.images || [],
      condition: item.tag || '闲置',
      isFree: false,
      certTags: [],
      extraInfo: item.content || '',
      seller: { name: item.user.name, avatar: item.user.avatar },
      distance: undefined,
      isFavorite: false,
      isRent: item.isRent,
      type: item.type
    }))
  },

  filterOtherList() {
    const { otherList, otherCurrentCategory, otherSearchKeyword, otherPage, otherPageSize } = this.data
    let result = [...otherList]
    if (otherCurrentCategory !== 'all') {
      result = result.filter(item => item.condition === otherCurrentCategory)
    }
    if (otherSearchKeyword.trim()) {
      const kw = otherSearchKeyword.trim().toLowerCase()
      result = result.filter(item =>
        item.title.toLowerCase().includes(kw) ||
        item.extraInfo.toLowerCase().includes(kw)
      )
    }
    const displayList = result.slice(0, otherPage * otherPageSize)
    this.setData({
      otherDisplayList: displayList,
      otherHasMore: result.length > displayList.length
    })
  },

  onOtherSearchInput(e) {
    this.setData({ otherSearchKeyword: e.detail.value })
  },

  onOtherSearchConfirm() {
    this.setData({ otherPage: 1, otherList: [] })
    this.loadIdleItems(1, true)
  },

  onOtherSearchClear() {
    this.setData({ otherSearchKeyword: '', otherPage: 1, otherList: [] })
    this.loadIdleItems(1, true)
  },

  switchOtherCategory(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.otherCurrentCategory) return
    this.setData({ otherCurrentCategory: key, otherPage: 1, otherList: [] })
    this.loadIdleItems(1, true)
  },

  refreshOtherList() {
    this.setData({ otherRefreshing: true })
    this.loadIdleItems(1, true).finally(() => {
      this.setData({ otherRefreshing: false })
    })
  },

  loadMoreOther() {
    if (!this.data.otherServerHasMore || this.data.otherLoading) return
    this.loadIdleItems(this.data.otherServerPage + 1, false)
  },

  toggleOtherFavorite(e) {
    if (!this.requireLogin()) return
    const id = e.currentTarget.dataset.id
    const target = this.data.otherList.find(item => item.id === id)
    if (!target) return
    const oldFav = target.isFavorite
    const newFav = !oldFav
    // 乐观更新：先切换本地状态，失败时回滚
    const applyFav = (fav) => {
      const list = this.data.otherList.map(item =>
        item.id === id ? { ...item, isFavorite: fav } : item
      )
      this.setData({ otherList: list }, () => this.filterOtherList())
    }
    applyFav(newFav)
    // 调用收藏 API
    request({
      url: '/api/v1/favorite/toggle',
      method: 'POST',
      data: { targetId: id, targetType: 2 }
    }).catch(() => {
      applyFav(oldFav)
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  /* ========== 二手闲置 API 加载方法 ========== */

  /**
   * 从后端加载二手书列表
   * @param {number} pageNum - 页码（1-based）
   * @param {boolean} reset - 是否重置已有数据；pageNum=1 时默认重置（与 loadErrands 语义一致，防止切校/重载残留旧数据）
   */
  loadIdleBooks(pageNum = 1, reset = pageNum === 1) {
    if (!canAccessCampusFeatures()) {
      this.setData({ bookLoading: false })
      return Promise.resolve()
    }
    if (this.data.bookLoading) return Promise.resolve()
    this.setData({ bookLoading: true })

    const params = { pageNum, pageSize: 20 }
    Object.assign(params, this.getBrowseParams())
    // 传递搜索关键词和分类筛选到后端
    if (this.data.bookSearchKeyword && this.data.bookSearchKeyword.trim()) {
      params.keyword = this.data.bookSearchKeyword.trim()
    }

    return request({
      url: '/api/v1/idle/product/book',
      method: 'GET',
      data: params
    }).then(data => {
      const newList = (data.list || []).map(vo => this._mapIdleBookVO(vo))
      const bookList = reset ? newList : [...this.data.bookList, ...newList]
      const hasMore = (data.list && data.list.length >= 20)

      this.setData({
        bookList,
        bookServerPage: pageNum,
        bookServerHasMore: hasMore,
        bookLoading: false
      })

      // 使用本地过滤再做展示（分类等客户端筛选）
      this.setData({ bookPage: reset ? 1 : this.data.bookPage })
      this.filterBookList()
    }).catch(err => {
      console.error('加载二手书列表失败:', err)
      this.setData({ bookLoading: false })
      if (reset && this.data.bookList.length === 0) {
        wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
      }
    })
  },

  /**
   * 从后端加载其他闲置列表
   * @param {number} pageNum - 页码（1-based）
   * @param {boolean} reset - 是否重置已有数据；pageNum=1 时默认重置（与 loadErrands 语义一致，防止切校/重载残留旧数据）
   */
  loadIdleItems(pageNum = 1, reset = pageNum === 1) {
    if (!canAccessCampusFeatures()) {
      this.setData({ otherLoading: false })
      return Promise.resolve()
    }
    if (this.data.otherLoading) return Promise.resolve()
    this.setData({ otherLoading: true })

    const params = { pageNum, pageSize: 20 }
    Object.assign(params, this.getBrowseParams())
    if (this.data.otherSearchKeyword && this.data.otherSearchKeyword.trim()) {
      params.keyword = this.data.otherSearchKeyword.trim()
    }
    if (this.data.otherCurrentCategory !== 'all') {
      params.category = this.data.otherCurrentCategory
    }

    return request({
      url: '/api/v1/idle/product/item',
      method: 'GET',
      data: params
    }).then(data => {
      const newList = (data.list || []).map(vo => this._mapIdleItemVO(vo))
      const otherList = reset ? newList : [...this.data.otherList, ...newList]
      const hasMore = (data.list && data.list.length >= 20)

      this.setData({
        otherList,
        otherServerPage: pageNum,
        otherServerHasMore: hasMore,
        otherLoading: false
      })

      // 客户端筛选 + 分页展示
      this.setData({ otherPage: reset ? 1 : this.data.otherPage })
      this.filterOtherList()
    }).catch(err => {
      console.error('加载其他闲置列表失败:', err)
      this.setData({ otherLoading: false })
      if (reset && this.data.otherList.length === 0) {
        wx.showToast({ title: '加载失败，请下拉刷新', icon: 'none' })
      }
    })
  },

  /**
   * 将 IdleBookListVO 映射为页面展示格式
   */
  _mapIdleBookVO(vo) {
    const conditionMap = { 1: '全新', 2: '九成新', 3: '八成新', 4: '有使用痕迹', 5: '较旧' }
    const condition = conditionMap[vo.conditionLevel] || '二手'

    return {
      id: vo.productId,
      title: vo.title || '',
      price: vo.price != null ? Number(vo.price) : 0,
      originalPrice: undefined,
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      condition,
      isFree: vo.price != null && Number(vo.price) === 0,
      certTags: vo.isTextbookMatched ? ['书库收录'] : [],
      extraInfo: [vo.author, vo.publisher, vo.edition].filter(Boolean).join(' / ') || '',
      category: '教材教辅', // 默认分类，后续可根据实际分类字段调整
      seller: { uid: String(vo.sellerId || ''), name: vo.sellerNickname || '南信大同学', avatar: toFullUrl(vo.sellerAvatar) || '/images/avatars/default.png' },
      distance: undefined,
      isFavorite: !!vo.isFavorite,
      isRent: false,
      type: 'secondhand'
    }
  },

  /**
   * 将 IdleItemListVO 映射为页面展示格式
   */
  _mapIdleItemVO(vo) {
    const conditionMap = { 1: '全新', 2: '九成新', 3: '八成新', 4: '有使用痕迹', 5: '较旧' }
    const condition = conditionMap[vo.conditionLevel] || '闲置'

    return {
      id: vo.productId,
      title: vo.title || '',
      price: vo.price != null ? Number(vo.price) : 0,
      originalPrice: undefined,
      images: vo.coverImage ? [toFullUrl(vo.coverImage)] : [],
      condition: vo.category || condition,
      isFree: vo.price != null && Number(vo.price) === 0,
      certTags: [],
      extraInfo: (vo.category || '') + (vo.deliveryType === 1 ? ' · 自取' : ' · 快递'),
      category: vo.category || '其他闲置',
      seller: { uid: String(vo.sellerId || ''), name: vo.sellerNickname || '南信大同学', avatar: toFullUrl(vo.sellerAvatar) || '/images/avatars/default.png' },
      distance: undefined,
      isFavorite: !!vo.isFavorite,
      isRent: false,
      type: 'secondhand'
    }
  }
})
