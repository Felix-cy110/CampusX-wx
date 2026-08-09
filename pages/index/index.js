const mock = require('../../utils/mock.js')
const app = getApp()
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    isLoggedIn: true,
    isJoinedSchool: true,
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
    followingUsersLoaded: false,
    _followScrollTop: 0,
    _followRefreshing: false,
    _followHasMore: true,
    _followCursor: null
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
    this.loadErrands()
    this.loadIdleBooks()
    this.loadIdleItems()
  },

  loadFeed() {
    // 读取本地点赞记录，合并到 feed 数据中（feed API 不返回 liked 字段）
    const likedIds = wx.getStorageSync('likedPostIds') || {}
    return request({ url: '/api/post/feed', method: 'GET', data: { pageSize: 20 } }).then(data => {
      console.log('feed API 返回:', JSON.stringify(data))
      const list = (data.list || []).map(vo => {
        // 兼容多种日期格式：字符串 或 数组 [year,month,day,hour,min,sec]
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
    }).catch(err => {
      console.error('loadFeed 失败:', JSON.stringify(err))
      wx.showToast({ title: '加载帖子失败，请下拉刷新', icon: 'none', duration: 2000 })
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn
    })

    /* 检查是否从选校页面返回了新学校 */
    const selectedSchool = wx.getStorageSync('selectedSchool')
    if (selectedSchool && selectedSchool !== this.data.schoolInfo.name) {
      const school = mock.schools.find(s => s.name === selectedSchool)
      if (school) {
        this.setData({
          schoolInfo: Object.assign({}, school, { icon: '/images/avatars/default.png' })
        })
      }
    }

    // 同步详情页的点赞/取消赞操作到列表
    this._syncPostLikeUpdate()
  },

  /* 加载教师评分（真实 API） */
  loadTeacherRatings() {
    this.setData({ teacherLoading: true })
    return request({
      url: '/api/v1/teacher/search',
      method: 'GET',
      data: { pageSize: 10 }
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
    if (!this.requireLogin()) return
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
    if (!app.globalData.isLoggedIn) {
      safeNavigate({ url: '/pages/login/login' })
      return false
    }
    return true
  },

  /* 跳转搜索 */
  goToSearch() {
    if (!this.requireLogin()) return
    safeNavigate({ url: '/pages/search/search' })
  },

  /* 跳转私信 */
  goToInbox() {
    if (!this.requireLogin()) return
    safeSwitch({ url: '/pages/inbox/inbox' })
  },

  /* 跳转发布 */
  goToPublish() {
    safeNavigate({ url: '/pages/publish-post/publish-post' })
  },

  /* 跳转帖子详情 */
  goToPostDetail(e) {
    if (!this.requireLogin()) return
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
    if (!this.requireLogin()) return
    const id = e.currentTarget.dataset.id
    const item = this.data.errandList.find(i => i.id === id)
    if (item) {
      wx.setStorageSync('currentErrand', item)
      safeNavigate({ url: `/pages/errand-detail/errand-detail?id=${id}` })
    }
  },

  /* 跳转供给详情（复用跑腿详情页） */
  goToSupplyDetail(e) {
    if (!this.requireLogin()) return
    const id = e.currentTarget.dataset.id
    const item = this.data.supplyList.find(i => i.id === id)
    if (item) {
      wx.setStorageSync('currentErrand', item)
      safeNavigate({ url: `/pages/errand-detail/errand-detail?id=${id}&type=supply` })
    }
  },

  /* 联系跑腿用户 */
  contactErrandUser(e) {
    if (!this.requireLogin()) return
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
    if (!this.requireLogin()) return
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
    if (this.data.errandLoading) return Promise.resolve()
    this.setData({ errandLoading: true })
    return request({
      url: '/api/v1/proxy-class-demand/list',
      method: 'GET',
      data: { pageNum, pageSize: 10 }
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
    if (this.data.supplyLoading) return Promise.resolve()
    this.setData({ supplyLoading: true })
    return request({
      url: '/api/v1/proxy-class-supply/list',
      method: 'GET',
      data: { pageNum, pageSize: 10 }
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
    const { filteredBookList, bookPage, bookPageSize } = this.data
    const list = filteredBookList.map(item => {
      if (item.id === id) {
        const newFav = !item.isFavorite
        // 调用收藏 API
        const url = newFav
          ? '/api/v1/favorite/toggle'
          : '/api/v1/favorite/toggle'
        request({
          url,
          method: 'POST',
          data: { targetId: id, targetType: 2 }
        }).catch(() => {})
        return { ...item, isFavorite: newFav }
      }
      return item
    })
    const displayList = list.slice(0, bookPage * bookPageSize)
    this.setData({ filteredBookList: list, bookDisplayList: displayList })
    wx.showToast({
      title: list.find(i => i.id === id).isFavorite ? '已收藏' : '已取消收藏',
      icon: 'none'
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
    if (!this.requireLogin()) return
    const id = e.currentTarget.dataset.id
    safeNavigate({ url: `/pages/market-detail/market-detail?id=${id}` })
  },

  /* ========== 关注视图方法 ========== */

  /** 加载关注用户列表（来自 /api/v1/follow/following） */
  loadFollowingUsers() {
    return request({
      url: '/api/v1/follow/following',
      data: { size: 20 }
    }).then(result => {
      const users = (result.list || []).map(vo => ({
        uid: String(vo.userId),
        name: vo.nickname || '',
        avatar: toFullUrl(vo.avatarUrl) || '',
        campusName: vo.campusName || '',
        hasNew: false
      }))
      this.setData({ followingUsers: users, followingUsersLoaded: true })
    }).catch(err => {
      console.error('加载关注用户失败:', err)
      this.setData({ followingUsersLoaded: true })
    })
  },

  /** 加载关注动态（只显示关注用户发布的帖子） */
  loadFollowingPosts(cursor) {
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
    }).catch(err => {
      console.error('加载关注动态失败:', err)
      this.setData({ _followRefreshing: false })
    })
  },

  /** 将 feed API 返回的 PostListVO 映射为前端展示格式 */
  _mapFeedItem(vo) {
    const likedIds = wx.getStorageSync('likedPostIds') || {}
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

  goToUserProfile(e) {
    if (!this.requireLogin()) return
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
    const id = e.currentTarget.dataset.id
    const { otherList } = this.data
    const list = otherList.map(item => {
      if (item.id === id) return { ...item, isFavorite: !item.isFavorite }
      return item
    })
    this.setData({ otherList: list }, () => this.filterOtherList())
  },

  /* ========== 二手闲置 API 加载方法 ========== */

  /**
   * 从后端加载二手书列表
   * @param {number} pageNum - 页码（1-based）
   * @param {boolean} reset - 是否重置已有数据
   */
  loadIdleBooks(pageNum = 1, reset = false) {
    if (this.data.bookLoading) return Promise.resolve()
    this.setData({ bookLoading: true })

    const params = { pageNum, pageSize: 20 }
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
   * @param {boolean} reset - 是否重置已有数据
   */
  loadIdleItems(pageNum = 1, reset = false) {
    if (this.data.otherLoading) return Promise.resolve()
    this.setData({ otherLoading: true })

    const params = { pageNum, pageSize: 20 }
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
      seller: { name: vo.sellerNickname || '南信大同学', avatar: toFullUrl(vo.sellerAvatar) || '/images/avatars/default.png' },
      distance: undefined,
      isFavorite: false,
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
      seller: { name: vo.sellerNickname || '南信大同学', avatar: toFullUrl(vo.sellerAvatar) || '/images/avatars/default.png' },
      distance: undefined,
      isFavorite: false,
      isRent: false,
      type: 'secondhand'
    }
  }
})
