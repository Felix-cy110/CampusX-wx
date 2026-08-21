const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')
const { markNotificationRead } = require('../../utils/unread')
const { getKnownFollowStatus, requestFollowChange } = require('../../utils/follow')

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
    } catch (err) {
      console.error('[followers] onLoad error:', err)
    }
  },

  onShow() {
    const followingList = this.data.followingList.map(item => ({
      ...item,
      isFollowed: getKnownFollowStatus(item.uid, item.isFollowed)
    })).filter(item => item.isFollowed)
    const followerList = this.data.followerList.map(item => ({
      ...item,
      isMutual: getKnownFollowStatus(item.uid, item.isMutual)
    }))
    this.setData({ followingList, followerList })
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

    const isFirstPage = !this.data.followerCursor
    return request({ url: '/api/v1/follow/followers', data: params }).then(data => {
      const rawList = data.list || []
      const list = rawList.map(mapFollowItem)
      const followerList = this.data.followerCursor
        ? this.data.followerList.concat(list)
        : list
      this.setData({
        followerList,
        followerLoading: false,
        followerHasMore: data.hasMore !== undefined ? data.hasMore : list.length >= 20,
        followerCursor: data.nextCursor || null
      })
      if (isFirstPage) {
        const readThrough = rawList.length > 0 ? rawList[0].createdAt : null
        if (readThrough) this.markFollowersRead(readThrough)
      }
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

    const operation = requestFollowChange(item.uid, item.isFollowed)
    if (!operation) return
    operation.then(confirmedFollowed => {
      const list = this.data.followingList.slice()
      if (!confirmedFollowed) {
        list.splice(index, 1)
      } else {
        list[index] = { ...list[index], isFollowed: true }
      }
      this.setData({ followingList: list })
      wx.showToast({ title: confirmedFollowed ? '已关注' : '已取消关注', icon: 'none' })
    }).catch(err => {
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  /** 关注/取关（粉丝列表） */
  toggleFollowerFollow(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.followerList[index]
    if (!item) return

    const operation = requestFollowChange(item.uid, item.isMutual)
    if (!operation) return
    operation.then(confirmedFollowed => {
      const list = this.data.followerList.slice()
      list[index] = { ...list[index], isMutual: confirmedFollowed }
      this.setData({ followerList: list })
      wx.showToast({ title: confirmedFollowed ? '已关注' : '已取消关注', icon: 'none' })
    }).catch(err => {
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  goToUserProfile(e) {
    const { uid, name, avatar } = e.currentTarget.dataset
    const currentUid = (getApp().globalData.userInfo || {}).uid
    if (uid && String(uid) === String(currentUid)) {
      safeSwitch({ url: '/pages/profile/profile' })
      return
    }
    safeNavigate({
      url: `/pages/user-home/user-home?userId=${uid || ''}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`
    })
  },

  navigateBack() {
    wx.navigateBack()
  },

  /** 标记粉丝通知为已读，并立即刷新 tabBar badge */
  markFollowersRead(readThrough) {
    markNotificationRead('followers', readThrough).catch(err => {
      console.error('标记粉丝通知已读失败:', err)
    })
  }
})

function mapFollowItem(item) {
  return {
    uid: String(item.userId || ''),
    avatar: toFullUrl(item.avatarUrl || ''),
    name: item.nickname || '',
    campusName: item.campusName || '',
    createdAt: item.createdAt || null,
    isFollowed: item.followedByMe !== undefined ? item.followedByMe : false,
    isMutual: item.followedByMe !== undefined ? item.followedByMe : false
  }
}
