const { safeNavigate, safeSwitch } = require('../utils/safeNavigate')
const { canAccessCampusFeatures, requireAuth } = require('../utils/auth')
const { getUnreadTotal, refreshUnreadCounts, subscribeUnreadCounts } = require('../utils/unread')

Component({
  data: {
    selected: 0,
    hidden: false,
    showPublishPopup: false,
    popupVisible: false,
    publishLoading: false,
    statusBarHeight: 0,
    _lastTapTime: 0,

    publishCategories: [
      { key: 'post', label: '图文帖子', desc: '发表图文内容', icon: '/images/SVG/图文.svg', bgColor: '#FFD4DC' },
      { key: 'secondhand', label: '二手挂单', desc: '发布二手交易信息', icon: '/images/SVG/挂单.svg', bgColor: '#FFE0C0' },
      { key: 'errand', label: '发布跑腿', desc: '找人帮忙跑腿', icon: '/images/SVG/跑腿 (2).svg', bgColor: '#C8E0FF' },
      { key: 'rating', label: '发起评分', desc: '给大家的评分', icon: '/images/SVG/评分 (2).svg', bgColor: '#FFD940' }
    ],
    list: [
      {
        pagePath: '/pages/index/index',
        text: '主页',
        iconPath: '/images/SVG/主页.svg',
        selectedIconPath: '/images/SVG/主页.svg'
      },
      {
        pagePath: '/pages/explore/explore',
        text: '活动',
        iconPath: '/images/SVG/活动.svg',
        selectedIconPath: '/images/SVG/活动.svg'
      },
      {
        pagePath: '/pages/inbox/inbox',
        text: '收件箱',
        iconPath: '/images/SVG/收件箱.svg',
        selectedIconPath: '/images/SVG/收件箱.svg',
        badge: 0
      },
      {
        pagePath: '/pages/profile/profile',
        text: '个人资料',
        iconPath: '/images/SVG/个人资料.svg',
        selectedIconPath: '/images/SVG/个人资料.svg'
      }
    ]
  },

  lifetimes: {
    attached() {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: systemInfo.statusBarHeight })
      // 每个 tab 页都有独立的自定义 TabBar 实例，必须各自订阅，不能只更新全局记录的一个实例。
      this._unsubscribeUnreadCounts = subscribeUnreadCounts(counts => {
        this.updateBadge(counts)
      })
      this.loadInboxBadge()
      // 将 tabBar 实例保存到全局，方便非 tab 页刷新 badge
      getApp().globalData._tabBar = this
    },

    detached() {
      if (this._unsubscribeUnreadCounts) {
        this._unsubscribeUnreadCounts()
        this._unsubscribeUnreadCounts = null
      }
      const globalData = getApp().globalData
      if (globalData._tabBar === this) globalData._tabBar = null
    }
  },

  pageLifetimes: {
    show() {
      // 首次加载时 globalData 尚未填充，跳过缓存更新，由 API 填充
      // 返回时 globalData 已有最新值，立即从缓存更新 badge（零延迟）
      if (getApp().globalData._notificationCountsLoaded) {
        this.updateBadgeFromGlobalData()
      }
      this.loadInboxBadge()
    }
  },

  methods: {
    /** 从后端获取收件箱未读数量并同步到 globalData（尊重乐观更新） */
    loadInboxBadge() {
      const that = this
      // 未登录或资料未完善时不请求校园功能接口，避免 401/1012 干扰 onboarding 导航。
      if (!canAccessCampusFeatures()) {
        that.setData({ 'list[2].badge': 0 })
        return Promise.resolve()
      }
      return refreshUnreadCounts().then(() => {
        that.updateBadgeFromGlobalData()
      }).catch(() => {
        // 请求失败用现有缓存兜底
        that.updateBadgeFromGlobalData()
      })
    },

    /** 直接从 globalData 计算并更新 badge（子页面进入时立即调用） */
    updateBadgeFromGlobalData() {
      const counts = getApp().globalData.notificationCounts || {}
      this.updateBadge(counts)
    },

    updateBadge(counts) {
      const badge = canAccessCampusFeatures() ? getUnreadTotal(counts) : 0
      this.setData({ 'list[2].badge': badge })
    },

    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const now = Date.now()

      if (index === this.data.selected) {
        if (now - this.data._lastTapTime < 300) {
          this.setData({ _lastTapTime: 0 })
          const pages = getCurrentPages()
          const page = pages[pages.length - 1]
          if (page && page.scrollToTop) {
            page.scrollToTop()
          } else {
            wx.pageScrollTo({ scrollTop: 0 })
          }
          return
        }
        this.setData({ _lastTapTime: now })

        return
      }

      this.setData({ _lastTapTime: 0 })
      const url = this.data.list[index].pagePath
      safeSwitch({ url })
    },

    togglePublishPopup() {
      if (this.data.popupVisible) {
        this.closePublishPopup()
      } else {
        if (!requireAuth()) return
        // 保存当前页面的原始顶部背景色（用于关闭时恢复）
        const selected = this.data.selected
        // selected 3 = 个人资料页（蓝色 #255AC5），其他页面白色
        const originalBgColor = selected === 3 ? '#255AC5' : '#FFFFFF'
        this._originalNavBgColor = originalBgColor

        wx.setNavigationBarColor({
          frontColor: '#000000',
          backgroundColor: '#F5F5F5'
        })
        // 在 navigationStyle: custom 模式下，需要额外设置页面顶层背景色
        // 否则原生状态栏会透出页面顶部的颜色（个人资料页为蓝色）
        wx.setBackgroundColor({
          backgroundColorTop: '#F5F5F5'
        })
        this.setData({ showPublishPopup: true })
        setTimeout(() => {
          this.setData({ popupVisible: true })
        }, 50)
      }
    },

    closePublishPopup() {
      const bgColor = this._originalNavBgColor || '#FFFFFF'
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: bgColor
      })
      wx.setBackgroundColor({
        backgroundColorTop: bgColor
      })
      this.setData({ popupVisible: false })
      setTimeout(() => {
        this.setData({ showPublishPopup: false })
      }, 300)
    },

    stopPropagation() {
      // 阻止冒泡，点击内容区不关闭
    },

    selectCategory(e) {
      const key = e.currentTarget.dataset.key
      const urlMap = {
        post: '/pages/publish-post/publish-post',
        secondhand: '/pages/publish-post/publish-post?mode=secondhand',
        rating: '/pages/publish-rating/publish-rating',
        errand: '/pages/publish-errand/publish-errand'
      }
      const url = urlMap[key]
      if (url) {
        safeNavigate({
          url,
          success: () => {
            this.setData({ popupVisible: false, showPublishPopup: false, publishLoading: false })
          },
          fail: () => this.setData({ publishLoading: false })
        })
      }
    }
  }
})
