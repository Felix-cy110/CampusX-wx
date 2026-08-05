const { request, toFullUrl } = require('../../utils/request')

Page({
  data: {
    currentTab: 'follower',
    followingList: [],
    followerList: [],
    followingLoading: false,
    followerLoading: false,
    followingHasMore: true,
    followerHasMore: true,
    followingCursor: null,
    followerCursor: null,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect()
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight,
        navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
      })
      this.loadFollowers()
      this.loadFollowing()
      this.markFollowersRead()
    } catch (err) {
      console.error('[followers] onLoad error:', err)
    }
  },

  /** 加载关注列表 */
  loadFollowing() {
    if (this.data.followingLoading || !this.data.followingHasMore) return
    this.setData({ followingLoading: true })

    const params = { size: 20 }
    if (this.data.followingCursor) {
      params.cursor = this.data.followingCursor
    }

    request({ url: '/api/v1/follow/following', data: params }).then(data => {
      const list = (data.list || []).map(mapFollowItem)
      const followingList = this.data.followingCursor
        ? this.data.followingList.concat(list)
        : list
      this.setData({
        followingList,
        followingLoading: false,
        followingHasMore: data.hasMore !== undefined ? data.hasMore : list.length >= 20,
        followingCursor: data.nextCursor || null
      })
    }).catch((err) => {
      console.error('[followers] loadFollowing fail:', err)
      this.setData({ followingLoading: false })
    })
  },

  /** 加载粉丝列表 */
  loadFollowers() {
    if (this.data.followerLoading || !this.data.followerHasMore) return
    this.setData({ followerLoading: true })

    const params = { size: 20 }
    if (this.data.followerCursor) {
      params.cursor = this.data.followerCursor
    }

    request({ url: '/api/v1/follow/followers', data: params }).then(data => {
      const list = (data.list || []).map(mapFollowItem)
      const followerList = this.data.followerCursor
        ? this.data.followerList.concat(list)
        : list
      this.setData({
        followerList,
        followerLoading: false,
        followerHasMore: data.hasMore !== undefined ? data.hasMore : list.length >= 20,
        followerCursor: data.nextCursor || null
      })
    }).catch((err) => {
      console.error('[followers] loadFollowers fail:', err)
      this.setData({ followerLoading: false })
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  /** 关注列表滚动到底部 */
  onFollowingScrollToLower() {
    this.loadFollowing()
  },

  /** 粉丝列表滚动到底部 */
  onFollowerScrollToLower() {
    this.loadFollowers()
  },

  /** 关注/取关（关注列表） */
  toggleFollow(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.followingList[index]
    if (!item) return

    if (item.isFollowed) {
      // 取关
      request({ url: `/api/v1/follow/${item.uid}`, method: 'DELETE' }).then(() => {
        const list = this.data.followingList.slice()
        list[index] = { ...list[index], isFollowed: false }
        this.setData({ followingList: list })
        wx.showToast({ title: '已取消关注', icon: 'none' })
      }).catch(() => {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      // 关注
      request({ url: `/api/v1/follow/${item.uid}`, method: 'POST' }).then(() => {
        const list = this.data.followingList.slice()
        list[index] = { ...list[index], isFollowed: true }
        this.setData({ followingList: list })
        wx.showToast({ title: '已关注', icon: 'none' })
      }).catch(() => {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    }
  },

  /** 关注/取关（粉丝列表） */
  toggleFollowerFollow(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.followerList[index]
    if (!item) return

    if (item.isMutual) {
      // 取关（已是互关状态）
      request({ url: `/api/v1/follow/${item.uid}`, method: 'DELETE' }).then(() => {
        const list = this.data.followerList.slice()
        list[index] = { ...list[index], isMutual: false }
        this.setData({ followerList: list })
        wx.showToast({ title: '已取消关注', icon: 'none' })
      }).catch(() => {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    } else {
      // 关注
      request({ url: `/api/v1/follow/${item.uid}`, method: 'POST' }).then(() => {
        const list = this.data.followerList.slice()
        list[index] = { ...list[index], isMutual: true }
        this.setData({ followerList: list })
        wx.showToast({ title: '已关注', icon: 'none' })
      }).catch(() => {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
    }
  },

  navigateBack() {
    wx.navigateBack()
  },

  /** 标记粉丝通知为已读，并立即刷新 tabBar badge */
  markFollowersRead() {
    const app = getApp()
    app.globalData.notificationCounts.followers = 0
    app.globalData._notificationReadSent.followers = true
    const tabBar = app.globalData._tabBar
    if (tabBar) tabBar.updateBadgeFromGlobalData()
    request({ url: '/api/v1/notification/read/followers', method: 'POST' }).catch(() => {})
    // 30秒安全兜底清除乐观标记（正常流程由 count API 确认归零后清除）
    if (app.globalData._followersReadTimer) clearTimeout(app.globalData._followersReadTimer)
    app.globalData._followersReadTimer = setTimeout(() => {
      app.globalData._notificationReadSent.followers = false
    }, 30000)
  }
})

function mapFollowItem(item) {
  return {
    uid: String(item.userId || ''),
    avatar: toFullUrl(item.avatarUrl || ''),
    name: item.nickname || '',
    campusName: item.campusName || '',
    isFollowed: item.followedByMe !== undefined ? item.followedByMe : false,
    isMutual: item.followedByMe !== undefined ? item.followedByMe : false
  }
}
