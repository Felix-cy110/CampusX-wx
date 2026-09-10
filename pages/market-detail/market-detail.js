const { request, toFullUrl } = require('../../utils/request')
const { refreshFollowStatus, requestFollowChange } = require('../../utils/follow')
const {
  createPaymentOrder,
  requestPayment,
  waitForPaymentResult,
  isPaymentProcessingError,
  isPaymentCancelledError
} = require('../../utils/payment')
const app = getApp()

function buildShareTitle(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return '分享一个校园好物'
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}

Page({
  data: {
    item: {},
    comments: [],
    itemId: '',
    orderId: '',
    productType: 'book',
    loadError: '',
    isLiked: false,
    isFavorited: false,
    isFollowed: false,
    followPending: false,
    purchasePending: false,
    isOwnerClosing: false,
    statusBarHeight: 0,
    navBarHeight: 0,
    /* 右上角「更多」按钮与胶囊按钮的安全间距（px），按胶囊实际位置动态计算 */
    capsuleGap: 0,
    loading: true
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    // 与资料页/收件箱页一致：按胶囊真实坐标计算安全间距，适配所有机型
    const capsuleGap = systemInfo.windowWidth - menuButton.left + 8
    this.setData({ statusBarHeight, navBarHeight, capsuleGap })

    const id = options.id || ''
    const type = options.type === 'rental' ? 'rental' : options.type === 'item' ? 'item' : 'book'
    const orderId = options.orderId ? String(options.orderId) : ''
    this.setData({ itemId: id, productType: type, orderId })
    return this.loadProductDetail(id, type)
  },

  onShow() {
    const item = this.data.item || {}
    const followeeId = item.user && item.user.uid
    if (followeeId && !item.isOwn) this.checkFollowStatus(followeeId)
  },

  onShareAppMessage() {
    const item = this.data.item || {}
    const shareConfig = {
      title: buildShareTitle(item.title),
      path: '/pages/market-detail/market-detail?id=' + encodeURIComponent(this.data.itemId) +
        '&type=' + this.data.productType
    }
    if (item.images && item.images[0]) shareConfig.imageUrl = item.images[0]
    return shareConfig
  },

  /** 加载商品详情 */
  async loadProductDetail(id, type) {
    if (!id) {
      this.setData({ item: {}, loading: false, loadError: '参数错误' })
      return
    }
    let productType = type === 'rental' ? 'rental' : type === 'item' ? 'item' : 'book'
    this.setData({ item: {}, loading: true, loadError: '', productType })

    try {
      let item
      try {
        item = await this.fetchProductDetail(id, productType)
      } catch (err) {
        // 旧帖子及分享链接可能不带类型；仅在明确类型不匹配时换接口。
        const mismatchMessage = productType === 'book' ? '该商品不是二手书' : '该商品不是闲置物品'
        if (productType === 'rental' || !err || Number(err.code) !== 422 || err.message !== mismatchMessage) throw err
        productType = productType === 'book' ? 'item' : 'book'
        this.setData({ productType })
        item = await this.fetchProductDetail(id, productType)
      }
      this.setData({ item, loading: false, productType })
      this.checkFavoriteStatus(id)
      this.checkFollowStatus(item.user && item.user.uid)
    } catch (err) {
      console.warn('商品详情加载失败:', id, err)
      this.setData({
        item: {},
        loading: false,
        loadError: (err && err.message) || '加载失败，请重试'
      })
    }
  },

  async fetchProductDetail(id, type) {
    const basePath = type === 'rental' ? '/api/v1/rental/product/' : '/api/v1/idle/product/' + type + '/'
    const vo = await request({
      url: basePath + encodeURIComponent(id),
      method: 'GET',
      data: this.data.orderId ? { orderId: this.data.orderId } : undefined
    })
    if (!vo || !vo.productId) throw new Error('商品信息加载失败，请重试')
    if (type === 'rental') return this.mapRentalDetail(vo)
    return type === 'book' ? this.mapBookDetail(vo) : this.mapItemDetail(vo)
  },

  retryLoad() {
    if (this.data.loading) return
    return this.loadProductDetail(this.data.itemId, this.data.productType)
  },

  /** 检查收藏状态 */
  checkFavoriteStatus(id) {
    request({
      url: '/api/v1/favorite/list',
      method: 'GET',
      data: { targetType: this.data.productType === 'rental' ? 1 : 2, pageNum: 1, pageSize: 100 }
    }).then(data => {
      const list = data.list || []
      const faved = list.some(f => String(f.targetId || f.itemId) === String(id))
      this.setData({ isFavorited: faved })
    }).catch(() => {})
  },

  checkFollowStatus(followeeId) {
    if (!followeeId || (this.data.item && this.data.item.isOwn)) return
    refreshFollowStatus(followeeId).then(data => {
      if (!data.stale) this.setData({ isFollowed: data.followedByMe })
    }).catch(err => {
      console.error('查询关注状态失败:', err)
    })
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
      condition: conditionText,
      deliveryType: deliveryMap[vo.deliveryType] || '自取',
      hasNotes: '',
      isOwn: this._checkIsOwn(vo.sellerId),
      isLiked: false,
      status: 'active'
    }
  },

  /** 租赁详情复用商品展示，租金、押金和交接方式按租赁接口映射。 */
  mapRentalDetail(vo) {
    const dateLabel = value => Array.isArray(value)
      ? value.slice(0, 3).map((part, index) => index ? String(part).padStart(2, '0') : String(part)).join('-')
      : String(value || '').slice(0, 10)
    return {
      ...this.mapItemDetail(vo),
      condition: '',
      price: vo.rentPrice != null ? Number(vo.rentPrice) : 0,
      deposit: vo.deposit != null ? Number(vo.deposit) : 0,
      rentUnitLabel: vo.rentUnit === 'piece' ? '次' : '天',
      availableStart: dateLabel(vo.availableStart),
      availableEnd: dateLabel(vo.availableEnd),
      deliveryType: vo.deliveryType === 2 ? '送达' : '自取'
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
      data: { targetId: Number(id), targetType: this.data.productType === 'rental' ? 1 : 2 }
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
    if (this.data.orderId || this.data.productType === 'rental' || !item.id || this.data.purchasePending) return

    wx.showModal({
      title: '确认下单',
      content: '确认购买「' + item.title + '」并支付？',
      success: (res) => {
        if (res.confirm) {
          this.purchaseItem(item)
        }
      }
    })
  },

  /** 创建业务订单后立即拉起微信支付，并以服务端查单结果为准。 */
  async purchaseItem(item) {
    if (this.data.orderId || this.data.productType === 'rental' || this.data.purchasePending) return
    this.setData({ purchasePending: true })

    try {
      wx.showLoading({ title: '创建订单...', mask: true })
      const order = await request({
        url: '/api/v1/idle/order',
        method: 'POST',
        data: { productId: Number(item.id) }
      })
      if (!order || !order.id) {
        throw new Error('后端未返回有效订单')
      }

      const paymentOrder = await createPaymentOrder({
        url: `/api/v1/idle/order/${order.id}/pay`,
        data: {}
      })
      wx.hideLoading()

      await requestPayment(paymentOrder.payParams)

      wx.showLoading({ title: '确认支付结果...', mask: true })
      await waitForPaymentResult(paymentOrder.paymentNo)
      wx.hideLoading()
      wx.showToast({ title: '支付成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('商品支付失败:', err)
      if (isPaymentCancelledError(err)) {
        wx.showToast({ title: '已取消支付，可重新购买', icon: 'none' })
      } else if (isPaymentProcessingError(err)) {
        wx.showModal({
          title: err.paymentSucceeded ? '支付成功' : '支付结果确认中',
          content: err.message,
          showCancel: false,
          confirmText: '知道了'
        })
      } else {
        wx.showToast({ title: (err && err.message) || '支付失败', icon: 'none' })
      }
    } finally {
      this.setData({ purchasePending: false })
    }
  },

  /** 关闭交易 */
  closeDeal() {
    if (this.data.orderId) return
    wx.showModal({
      title: '下架商品',
      content: '确定要下架这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          const id = this.data.itemId
          const module = this.data.productType === 'rental' ? 'rental' : 'idle'
          request({
            url: `/api/v1/${module}/product/${id}/off-shelf`,
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
    if (!followeeId || item.isOwn || this.data.followPending) return

    const operation = requestFollowChange(followeeId, this.data.isFollowed)
    if (!operation) return
    this.setData({ followPending: true })
    operation.then(confirmedFollowed => {
      this.setData({ isFollowed: confirmedFollowed })
      wx.showToast({ title: confirmedFollowed ? '已关注' : '已取消关注', icon: 'none' })
    }).catch(err => {
      console.error('关注操作失败:', err)
      wx.showToast({ title: (err && err.message) || '操作失败，请重试', icon: 'none' })
    }).finally(() => {
      this.setData({ followPending: false })
    })
  },

  showMoreOptions() {
    wx.showActionSheet({
      itemList: ['举报商品'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.doReport()
        }
      }
    })
  },

  doReport() {
    const targetType = this.data.productType === 'rental' ? 'RENTAL_PRODUCT' : 'IDLE_PRODUCT'
    wx.navigateTo({
      url: '/pages/complaint/complaint?targetType=' + targetType + '&targetId=' + this.data.itemId
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
