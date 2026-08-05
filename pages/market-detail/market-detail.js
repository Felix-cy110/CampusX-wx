const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    item: {},
    comments: [],
    itemId: '',
    isLiked: false,
    isFavorited: false,
    isFollowed: false,
    isOwnerClosing: false,
    statusBarHeight: 0,
    navBarHeight: 0,
    loading: true
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })

    const id = parseInt(options.id) || 0
    const subType = options.subType || '1'

    if (id) {
      this.loadProductDetail(id, subType)
    }
  },

  loadProductDetail(id, subType) {
    const apiUrl = subType === '2'
      ? '/api/v1/idle/product/item/' + id
      : '/api/v1/idle/product/book/' + id

    request({ url: apiUrl, method: 'GET' }).then(vo => {
      const conditionLabels = { 1: '全新', 2: '九成新', 3: '八成新', 4: '有使用痕迹', 5: '较旧' }
      const item = {
        id: vo.productId,
        user: {
          uid: String(vo.sellerId || ''),
          name: vo.sellerNickname || '',
          avatar: toFullUrl(vo.sellerAvatar) || ''
        },
        title: vo.title || '',
        content: vo.description || '',
        images: (vo.imageUrls || []).map(toFullUrl),
        price: vo.price,
        conditionLevel: vo.conditionLevel,
        conditionLabel: conditionLabels[vo.conditionLevel] || '',
        deliveryType: vo.deliveryType,
        deliveryLabel: vo.deliveryType === 2 ? '快递' : '自取',
        category: vo.category || '',
        subType: vo.subType,
        time: vo.createdAt ? vo.createdAt.replace('T', ' ').slice(0, 16) : '',
        stats: { likes: 0, comments: 0 },
        isLiked: false,
        isOwn: false
      }
      // 二手书额外信息
      if (vo.subType === 1 || !vo.subType) {
        item.extraInfo = [vo.author, vo.publisher, vo.edition].filter(Boolean).join(' / ')
      } else {
        item.extraInfo = vo.category || ''
      }
      this.setData({ item, itemId: id })
    }).catch(err => {
      console.error('加载商品详情失败:', err)
      wx.showToast({ title: '商品不存在或已下架', icon: 'none' })
    })
  },

  goBack() {
    wx.navigateBack()
  },

  toggleLike() {
    wx.showToast({ title: '点赞功能', icon: 'none' })
  },

  toggleFavorite() {
    const id = this.data.itemId
    const isFav = !this.data.isFavorited
    this.setData({ isFavorited: isFav })

    request({
      url: '/api/v1/favorite/toggle',
      method: 'POST',
      data: { itemId: Number(id), itemType: 'IDLE_PRODUCT' }
    }).then(() => {
      wx.showToast({ title: isFav ? '已收藏' : '已取消收藏', icon: 'none' })
    }).catch(err => {
      this.setData({ isFavorited: !isFav })
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  contactSeller() {
    const { item } = this.data
    const userId = item.user && item.user.uid
    if (userId) {
      safeNavigate({
        url: `/pages/chat/chat?userId=${userId}&name=${encodeURIComponent(item.user.name)}&avatar=${encodeURIComponent(item.user.avatar)}`
      })
    } else {
      wx.showToast({ title: '无法联系卖家', icon: 'none' })
    }
  },

  /** 创建订单 */
  createOrder() {
    const item = this.data.item
    if (!item.id) return

    wx.showModal({
      title: '确认下单',
      content: '确认购买「' + item.title + '」？',
      success: (res) => {
        if (res.confirm) {
          request({
            url: '/api/v1/idle/order',
            method: 'POST',
            data: { productId: Number(item.id) }
          }).then(vo => {
            wx.showToast({ title: '下单成功', icon: 'success' })
            // 跳转到支付页面或订单列表
          }).catch(err => {
            wx.showToast({ title: (err && err.message) || '下单失败', icon: 'none' })
          })
        }
      }
    })
  },

  /** 关闭交易 */
  closeDeal() {
    wx.showModal({
      title: '下架商品',
      content: '确定要下架这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          const id = this.data.itemId
          request({
            url: `/api/v1/idle/product/${id}/off-shelf`,
            method: 'PUT'
          }).then(() => {
            this.setData({ isOwnerClosing: true })
            wx.showToast({ title: '已下架', icon: 'none' })
          }).catch(err => {
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
          })
        }
      }
    })
  },

  toggleFollow() {
    const item = this.data.item
    const followeeId = item.user && item.user.uid
    if (!followeeId) return

    const isFollowed = !this.data.isFollowed
    const url = isFollowed
      ? '/api/v1/follow/' + followeeId
      : null

    if (isFollowed) {
      request({ url, method: 'POST' }).then(() => {
        this.setData({ isFollowed: true })
        wx.showToast({ title: '已关注', icon: 'none' })
      }).catch(() => {})
    } else {
      request({ url: '/api/v1/follow/' + followeeId, method: 'DELETE' }).then(() => {
        this.setData({ isFollowed: false })
        wx.showToast({ title: '已取消关注', icon: 'none' })
      }).catch(() => {})
    }
  },

  showMoreOptions() {
    wx.showActionSheet({
      itemList: ['举报帖子', '分享给好友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.doReport()
        }
      }
    })
  },

  doReport() {
    wx.navigateTo({
      url: '/pages/complaint/complaint?targetType=IDLE_PRODUCT&targetId=' + this.data.itemId
    })
  },

  goToUserProfile(e) {
    const { uid, name, avatar } = e.currentTarget.dataset
    const currentUid = (app.globalData.userInfo || {}).uid
    if (uid && String(uid) === String(currentUid)) {
      wx.switchTab({ url: '/pages/profile/profile' })
      return
    }
    wx.navigateTo({
      url: `/pages/user-home/user-home?userId=${uid || ''}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`
    })
  },

  toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id
    const comments = this.data.comments.map(c => {
      if (c.id === commentId) {
        c.liked = !c.liked
        c.likes += c.liked ? 1 : -1
      }
      return c
    })
    this.setData({ comments })
  },

  replyComment(e) {
    wx.showToast({ title: '回复功能开发中', icon: 'none' })
  },

  addComment() {
    wx.showToast({ title: '评论功能开发中', icon: 'none' })
  }
})
