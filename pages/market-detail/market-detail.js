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

    const id = options.id
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    // 判断商品类型：优先尝试二手书详情 API
    const type = options.type || 'book'
    this.setData({ itemId: id })
    this.loadProductDetail(id, type)
  },

  /** 加载商品详情 */
  loadProductDetail(id, type) {
    this.setData({ loading: true })

    if (type === 'item') {
      // 闲置物品 → 走 item 详情 API
      this.loadItemDetail(id)
    } else {
      // 默认按二手书处理
      this.loadBookDetail(id)
    }
  },

  /** 加载二手书详情 */
  loadBookDetail(id) {
    request({
      url: '/api/v1/idle/product/book/' + id,
      method: 'GET'
    }).then(vo => {
      const item = this.mapBookDetail(vo)
      this.setData({ item, loading: false })
      this.checkFavoriteStatus(id)
    }).catch(err => {
      console.warn('二手书详情加载失败，尝试作为闲置物品加载:', err)
      this.loadItemDetail(id)
    })
  },

  /** 加载闲置物品详情 */
  loadItemDetail(id) {
    request({
      url: '/api/v1/idle/product/item/' + id,
      method: 'GET'
    }).then(vo => {
      const item = this.mapItemDetail(vo)
      this.setData({ item, loading: false })
      this.checkFavoriteStatus(id)
    }).catch(() => {
      // item API 也失败，降级到列表查找
      this.fallbackLoadItem(id)
    })
  },

  /** 降级加载：通过列表接口查找商品 */
  fallbackLoadItem(id) {
    request({
      url: '/api/v1/idle/product/item',
      method: 'GET',
      data: { pageNum: 1, pageSize: 50 }
    }).then(data => {
      const list = data.list || []
      const vo = list.find(v => String(v.productId) === String(id))
      if (vo) {
        const item = this.mapItemDetail(vo)
        this.setData({ item, loading: false })
      } else {
        wx.showToast({ title: '商品不存在', icon: 'none' })
        this.setData({ loading: false })
      }
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  /** 检查收藏状态 */
  checkFavoriteStatus(id) {
    request({
      url: '/api/v1/favorite/list',
      method: 'GET',
      data: { targetType: 2, pageNum: 1, pageSize: 100 }
    }).then(data => {
      const list = data.list || []
      const faved = list.some(f => String(f.targetId || f.itemId) === String(id))
      this.setData({ isFavorited: faved })
    }).catch(() => {})
  },

  /** 映射二手书详情 VO → 前端展示格式 */
  mapBookDetail(vo) {
    const conditionMap = { 1: '全新', 2: '九成新', 3: '八成新', 4: '有使用痕迹', 5: '较旧' }
    const deliveryMap = { 1: '自取', 2: '快递' }
    const conditionText = conditionMap[vo.conditionLevel] || '二手'

    // 构建描述文本
    let desc = vo.description || ''
    if (!desc && vo.author) {
      desc = [vo.author, vo.publisher, '第' + (vo.edition || '一') + '版'].filter(Boolean).join(' / ')
    }

    return {
      id: vo.productId,
      user: {
        uid: String(vo.sellerId || ''),
        name: vo.sellerNickname || '南信大同学',
        avatar: toFullUrl(vo.sellerAvatar) || '/images/avatars/default.png'
      },
      title: vo.title || '',
      content: desc,
      images: (vo.imageUrls || []).map(toFullUrl),
      stats: { likes: 0, comments: 0 },
      time: this.formatTime(vo.createdAt),
      price: vo.price != null ? Number(vo.price) : 0,
      condition: conditionText,
      deliveryType: deliveryMap[vo.deliveryType] || '自取',
      hasNotes: vo.hasNotes ? '有笔记划线' : '无笔记划线',
      isTextbookMatched: vo.isTextbookMatched,
      author: vo.author || '',
      publisher: vo.publisher || '',
      edition: vo.edition || '',
      courses: vo.courses || [],
      isOwn: this._checkIsOwn(vo.sellerId),
      isLiked: false,
      status: 'active'
    }
  },

  /** 判断是否为当前用户发布的商品 */
  _checkIsOwn(sellerId) {
    const uid = (app.globalData.userInfo || {}).uid
    return String(sellerId || '') === String(uid || '')
  },

  /** 映射闲置详情 VO 或列表项 → 详情页格式 */
  mapItemDetail(vo) {
    const conditionMap = { 1: '全新', 2: '九成新', 3: '八成新', 4: '有使用痕迹', 5: '较旧' }
    const conditionText = conditionMap[vo.conditionLevel] || '闲置'
    const deliveryMap = { 1: '自取', 2: '快递' }

    return {
      id: vo.productId,
      user: {
        uid: String(vo.sellerId || ''),
        name: vo.sellerNickname || '南信大同学',
        avatar: toFullUrl(vo.sellerAvatar) || '/images/avatars/default.png'
      },
      title: vo.title || '',
      content: vo.description || vo.category || '',
      images: (vo.imageUrls && vo.imageUrls.length > 0)
        ? vo.imageUrls.map(toFullUrl)
        : (vo.coverImage ? [toFullUrl(vo.coverImage)] : []),
      stats: { likes: 0, comments: 0 },
      time: this.formatTime(vo.createdAt),
      price: vo.price != null ? Number(vo.price) : 0,
      condition: vo.category || conditionText,
      deliveryType: deliveryMap[vo.deliveryType] || '自取',
      hasNotes: '',
      isOwn: this._checkIsOwn(vo.sellerId),
      isLiked: false,
      status: 'active'
    }
  },

  /** 时间格式化 */
  formatTime(dateValue) {
    if (!dateValue) return ''
    let date
    if (Array.isArray(dateValue)) {
      date = new Date(dateValue[0], dateValue[1] - 1, dateValue[2], dateValue[3] || 0, dateValue[4] || 0, dateValue[5] || 0)
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue.replace('T', ' '))
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
    if (days < 365) return Math.floor(days / 30) + '个月前'
    return Math.floor(days / 365) + '年前'
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
      data: { targetId: Number(id), targetType: 2 }
    }).then(() => {
      wx.showToast({ title: isFav ? '已收藏' : '已取消收藏', icon: 'none' })
    }).catch(err => {
      this.setData({ isFavorited: !isFav })
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    })
  },

  contactSeller() {
    const item = this.data.item
    const userId = item.user && item.user.uid
    if (userId) {
      wx.navigateTo({
        url: `/pages/chat/chat?userId=${userId}&name=${encodeURIComponent(item.user.name || '')}&avatar=${encodeURIComponent(item.user.avatar || '')}`
      })
    } else {
      wx.showToast({ title: '卖家信息不可用', icon: 'none' })
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
