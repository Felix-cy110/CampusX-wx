const { request, toFullUrl } = require('../../utils/request')
const { safeNavigate, safeSwitch } = require('../../utils/safeNavigate')
const { getKnownFollowStatus, requestFollowChange } = require('../../utils/follow')

Page({
  data: {
    currentTab: 'following',
    followingList: [],
    followerList: [],
    // 关注列表分页
    followingCursor: null,
    followingHasMore: true,
    followingLoading: false,
    // 粉丝列表分页
    followerCursor: null,
    followerHasMore: true,
    followerLoading: false,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height
    })
    this.loadFollowing()
    this.loadFollowers()
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

  /* ====== 关注列表 ====== */

  loadFollowing() {
    if (this.data.followingLoading || !this.data.followingHasMore) return
    this.setData({ followingLoading: true })

    const params = { size: 20 }
    if (this.data.followingCursor) {
      params.cursor = this.data.followingCursor
    }

    request({
      url: '/api/v1/follow/following',
      method: 'GET',
      data: params
    }).then(result => {
      const list = (result.list || []).map(mapFollowItem)
      const newList = this.data.followingList.concat(list)
      this.setData({
        followingList: newList,
        followingCursor: result.nextCursor || null,
        followingHasMore: result.hasMore !== false,
        followingLoading: false
      })
    }).catch(err => {
      console.error('加载关注列表失败:', err)
      this.setData({ followingLoading: false })
    })
  },

  /* ====== 粉丝列表 ====== */

  loadFollowers() {
    if (this.data.followerLoading || !this.data.followerHasMore) return
    this.setData({ followerLoading: true })

    const params = { size: 20 }
    if (this.data.followerCursor) {
      params.cursor = this.data.followerCursor
    }

    request({
      url: '/api/v1/follow/followers',
      method: 'GET',
      data: params
    }).then(result => {
      const list = (result.list || []).map(mapFollowItem)
      const newList = this.data.followerList.concat(list)
      this.setData({
        followerList: newList,
        followerCursor: result.nextCursor || null,
        followerHasMore: result.hasMore !== false,
        followerLoading: false
      })
    }).catch(err => {
      console.error('加载粉丝列表失败:', err)
      this.setData({ followerLoading: false })
    })
  },

  /* ====== 上拉加载更多 ====== */

  onFollowingScrollToLower() {
    if (this.data.currentTab === 'following') {
      this.loadFollowing()
    } else {
      this.loadFollowers()
    }
  },

  /* ====== Tab 切换 ====== */

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  /* ====== 关注/取关 ====== */

  // 在关注列表中取关
  toggleFollow(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.followingList[index]
    if (!item) return

    const isFollowed = item.isFollowed
    const operation = requestFollowChange(item.uid, isFollowed)
    if (!operation) return
    operation.then(confirmedFollowed => {
      const list = this.data.followingList.slice()
      // 取关后从列表移除；关注后更新状态
      if (!confirmedFollowed) {
        list.splice(index, 1)
        wx.showToast({ title: '已取消关注', icon: 'none' })
      } else {
        list[index] = { ...list[index], isFollowed: true }
        wx.showToast({ title: '已关注', icon: 'none' })
      }
      this.setData({ followingList: list })
    }).catch(err => {
      console.error('操作失败:', err)
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  // 在粉丝列表中关注/取关
  toggleFollowerFollow(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.followerList[index]
    if (!item) return

    const isMutual = item.isMutual
    const operation = requestFollowChange(item.uid, isMutual)
    if (!operation) return
    operation.then(confirmedFollowed => {
      const list = this.data.followerList.slice()
      list[index] = { ...list[index], isMutual: confirmedFollowed }
      this.setData({ followerList: list })
      wx.showToast({
        title: confirmedFollowed ? '已关注' : '已取消关注',
        icon: 'none'
      })
    }).catch(err => {
      console.error('操作失败:', err)
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  /* ====== 导航 ====== */

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

  goBack() {
    wx.navigateBack()
  }
})

/**
 * 将后端 UserFollowItemVO 映射为前端列表项格式
 */
function mapFollowItem(vo) {
  return {
    uid: String(vo.userId),
    avatar: toFullUrl(vo.avatarUrl) || '',
    name: vo.nickname || '',
    campusName: vo.campusName || '',
    // 在关注列表中，followedByMe 恒为 true；在粉丝列表中作为 isMutual
    isFollowed: vo.followedByMe !== undefined ? vo.followedByMe : true,
    isMutual: vo.followedByMe !== undefined ? vo.followedByMe : false
  }
}
