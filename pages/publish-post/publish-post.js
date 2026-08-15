const { safeNavigate } = require('../../utils/safeNavigate')
const { request, getBaseUrl } = require('../../utils/request')
const { handleAuthFailure } = require('../../utils/auth')
const {
  requestPayment,
  waitForPaymentResult,
  isPaymentProcessingError,
  isPaymentCancelledError
} = require('../../utils/payment')
const app = getApp()

Page({
  onLoad(options) {
    if (options.mode) {
      this.setData({
        mode: options.mode,
        tabIndicatorRatio: options.mode === 'feed' ? 0.25 : 0.75
      })
    }
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    // 默认目标学校为用户本校
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      statusBarHeight,
      navBarHeight,
      targetCampusId: userInfo.campusId || null,
      targetSchool: userInfo.school || ''
    })

    // 编辑模式
    if (options.editId) {
      this.setData({ isEditMode: true, editId: options.editId, mode: 'feed' })
      this.loadEditData(options.editId)
    }

    // 初次加载时判断是否跨校
    this.checkCrossSchool()
  },

  /* 加载编辑数据 */
  loadEditData(postId) {
    // 先从 storage 读取缓存数据快速预填
    const postStr = wx.getStorageSync('editPostData')
    if (postStr) {
      try {
        const post = JSON.parse(postStr)
        if (String(post.id) === String(postId)) {
          this.prefillForm(post)
        }
      } catch (e) {
        // ignore
      }
    }
    // 再从后端获取最新数据
    request({ url: '/api/post/' + postId }).then(vo => {
      const post = {
        id: vo.id,
        title: vo.title || '',
        content: vo.content || '',
        images: (vo.imageUrls || []).map(u => {
          if (u.startsWith('http')) return u
          return getBaseUrl() + u
        }),
        targetCampusId: vo.targetCampusId || vo.campusId || null,
        targetSchool: vo.campusName || vo.school || ''
      }
      this.prefillForm(post)
      // 更新缓存
      wx.setStorageSync('editPostData', JSON.stringify(post))
    }).catch(() => {
      // 静默失败，使用缓存数据
    })
  },

  /* 预填表单 */
  prefillForm(post) {
    this.setData({
      title: post.title || '',
      content: post.content || post.fullContent || '',
      images: post.images || [],
      targetCampusId: post.targetCampusId || post.campusId || this.data.targetCampusId,
      targetSchool: post.targetSchool || post.campusName || post.school || this.data.targetSchool
    })
    this.checkCrossSchool()
  },

  onShow() {
    // 从 select-school 页面返回时，读取选中的学校
    const schoolStr = wx.getStorageSync('selectedSchool')
    if (schoolStr) {
      try {
        const school = JSON.parse(schoolStr)
        this.setData({
          targetSchool: school.name || '',
          targetCampusId: school.id || null
        })
        // 清除 storage 防止下次打开页面时显示旧数据
        wx.removeStorageSync('selectedSchool')
      } catch (e) {
        // ignore parse error
      }
    }
    // 每次返回页面时重新判断是否跨校，并加载额度
    this.checkCrossSchool()
    if (this.data.isCrossSchool) {
      this.loadQuota()
    }
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    mode: 'feed',
    tabIndicatorRatio: 0.25,

    // ===== 图文帖子 form =====
    // 分类由后端 AI Agent 自动归类，前端传默认值即可
    title: '',
    titleMax: 100,
    content: '',
    contentMax: 2000,
    showContact: false,
    contact: '',
    images: [],
    targetSchool: '',
    targetCampusId: null,

    // ===== 付费选项 =====
    buyLotteryTicket: false,
    isCrossSchool: false,
    quotaLoaded: false,
    quotaInfo: {
      remainingFreeCount: 0,
      usedFreeCount: 0,
      yearMonth: ''
    },

    // ===== 二手挂单 form =====
    idleTypes: [
      { label: '二手书', value: 'book' },
      { label: '其他闲置', value: 'item' }
    ],
    selectedIdleType: 'book',
    itemCategories: ['数码', '生活用品', '服饰', '运动', '其他'],
    selectedItemCategory: '',
    // 二手书专用字段
    bookAuthor: '',
    bookPublisher: '',
    bookEdition: '',
    hasNotes: null,
    // 闲置描述
    description: '',
    descriptionMax: 2000,
    // 新旧程度 (对应后端 conditionLevel: 1-5)
    conditionLevels: [
      { label: '全新', value: 1 },
      { label: '九成新', value: 2 },
      { label: '八成新', value: 3 },
      { label: '有使用痕迹', value: 4 },
      { label: '较旧', value: 5 }
    ],
    selectedConditionLevel: null,
    // 交货方式 (对应后端 deliveryType: 1-自取, 2-快递)
    deliveryTypes: [
      { label: '自取', value: 1 },
      { label: '快递', value: 2 }
    ],
    selectedDeliveryType: null,
    price: '',
    priceFocused: false,

    isEditMode: false,
    editId: null,
    publishing: false
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({
      mode,
      tabIndicatorRatio: mode === 'feed' ? 0.25 : 0.75
    })
  },

  switchToSecondhand() {
    this.setData({
      mode: 'secondhand',
      tabIndicatorRatio: 0.75
    })
  },

  // ===== 图文帖子 handlers =====

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  fillContentAsTitle() {
    this.setData({ content: '如题' })
  },

  addImage() {
    wx.chooseImage({
      count: 9 - this.data.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ images: this.data.images.concat(res.tempFilePaths) })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images
    images.splice(index, 1)
    this.setData({ images })
  },

  toggleContact() {
    this.setData({ showContact: !this.data.showContact })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  selectTargetSchool() {
    safeNavigate({ url: '/pages/select-school/select-school' })
  },

  // ===== 二手挂单 handlers =====

  selectIdleType(e) {
    const val = e.currentTarget.dataset.value
    this.setData({
      selectedIdleType: this.data.selectedIdleType === val ? '' : val,
      // 切换类型时清空子分类
      selectedItemCategory: ''
    })
  },

  selectItemCategory(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ selectedItemCategory: this.data.selectedItemCategory === cat ? '' : cat })
  },

  selectConditionLevel(e) {
    const val = Number(e.currentTarget.dataset.value)
    this.setData({ selectedConditionLevel: this.data.selectedConditionLevel === val ? null : val })
  },

  selectDeliveryType(e) {
    const val = Number(e.currentTarget.dataset.value)
    this.setData({ selectedDeliveryType: this.data.selectedDeliveryType === val ? null : val })
  },

  selectHasNotes(e) {
    const val = Number(e.currentTarget.dataset.value)
    this.setData({ hasNotes: this.data.hasNotes === val ? null : val })
  },

  onBookAuthorInput(e) {
    this.setData({ bookAuthor: e.detail.value })
  },

  onBookPublisherInput(e) {
    this.setData({ bookPublisher: e.detail.value })
  },

  onBookEditionInput(e) {
    this.setData({ bookEdition: e.detail.value })
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value })
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value })
  },

  onPriceFocus() {
    this.setData({ priceFocused: true })
  },

  onPriceBlur() {
    this.setData({ priceFocused: false })
  },

  goBack() {
    wx.navigateBack()
  },

  // ===== 图片上传 =====
  /**
   * 上传单张图片，返回服务器图片 URL
   */
  uploadImage(filePath) {
    const token = wx.getStorageSync('token') || ''
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: getBaseUrl() + '/api/v1/upload/image',
        filePath: filePath,
        name: 'file',
        header: {
          Authorization: 'Bearer ' + token
        },
        success: (res) => {
          try {
            const result = JSON.parse(res.data)
            if (result.code === 200 && result.data && result.data.url) {
              resolve(result.data.url)
            } else {
              handleAuthFailure(result, token)
              reject(result)
            }
          } catch (e) {
            reject(new Error('解析上传结果失败'))
          }
        },
        fail: reject
      })
    })
  },

  /**
   * 批量上传图片，返回图片 URL 数组
   */
  async uploadImages() {
    const { images } = this.data
    if (!images || images.length === 0) return []
    const urls = []
    for (const path of images) {
      const url = await this.uploadImage(path)
      urls.push(url)
    }
    return urls
  },

  // ===== 付费选项 =====

  /**
   * 判断当前选择的目标学校是否为跨校
   */
  checkCrossSchool() {
    const userInfo = getApp().globalData.userInfo || {}
    const userCampusId = userInfo.campusId || null
    const { targetCampusId, isCrossSchool: wasCrossSchool } = this.data
    const isCrossSchool = !!(userCampusId && targetCampusId && userCampusId !== targetCampusId)
    // 从跨校切换回本校时，重置额度加载状态
    if (wasCrossSchool && !isCrossSchool) {
      this.setData({ isCrossSchool, quotaLoaded: false })
    } else {
      this.setData({ isCrossSchool })
    }
  },

  /**
   * 加载当前用户当月跨校发帖额度
   */
  async loadQuota() {
    try {
      const quota = await request({
        url: '/api/post/cross-school-quota/current',
        method: 'GET'
      })
      this.setData({ quotaInfo: quota, quotaLoaded: true })
    } catch (err) {
      console.error('加载跨校发帖额度失败:', err)
      this.setData({ quotaLoaded: false })
    }
  },

  /**
   * 切换抽奖号码购买选项
   */
  toggleLottery() {
    this.setData({ buyLotteryTicket: !this.data.buyLotteryTicket })
  },

  async confirmPayment(payParams, paymentNo) {
    await requestPayment(payParams)
    wx.showLoading({ title: '确认支付结果...', mask: true })
    try {
      return await waitForPaymentResult(paymentNo)
    } finally {
      wx.hideLoading()
    }
  },

  // ===== 提交 =====

  async onSubmit() {
    if (this.data.publishing) return
    if (this.data.isEditMode) {
      await this.updatePost()
      return
    }
    const { mode } = this.data

    if (mode === 'feed') {
      await this.publishPost()
    } else {
      await this.publishIdle()
    }
  },

  /**
   * 更新图文帖子（编辑模式）
   */
  async updatePost() {
    const { title, content, editId, images, targetCampusId } = this.data

    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    this.setData({ publishing: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      // 先上传新增的图片（本地临时路径需要上传）
      const uploadedUrls = []
      for (const path of images) {
        if (path.startsWith('http')) {
          uploadedUrls.push(path)
        } else {
          const url = await this.uploadImage(path)
          uploadedUrls.push(url)
        }
      }

      const body = {
        title: title.trim(),
        content: content.trim(),
        category: 6,
        targetCampusId: targetCampusId
      }
      if (this.data.showContact && this.data.contact.trim()) {
        body.contact = this.data.contact.trim()
      }
      if (uploadedUrls.length > 0) {
        body.imageUrls = uploadedUrls
      }

      const editBody = {
        ...body,
        postId: Number(editId)
      }
      await request({
        url: '/api/post/edit',
        method: 'POST',
        data: editBody
      })

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      // 通知上一页数据已更新
      wx.setStorageSync('editedPostData', JSON.stringify({ id: editId, title: title.trim(), content: content.trim(), images: uploadedUrls }))
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('更新帖子失败:', err)
      wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  },

  /**
   * 发布图文帖子
   * 三种场景：
   * 1. 本校发帖（无抽奖）
   * 2. 本校发帖 + 购买抽奖号码
   * 3. 跨校发帖（免费额度 / 付费）
   */
  async publishPost() {
    const { title, content, targetCampusId, isCrossSchool, buyLotteryTicket, quotaInfo } = this.data

    // 校验
    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    if (!targetCampusId) {
      wx.showToast({ title: '请选择目标学校', icon: 'none' })
      return
    }

    this.setData({ publishing: true })
    wx.showLoading({ title: '发布中...', mask: true })

    try {
      // 先上传图片
      const imageUrls = await this.uploadImages()

      // 构建基础请求体
      const body = {
        title: title.trim(),
        category: 6,
        content: content.trim(),
        targetCampusId: targetCampusId
      }
      if (this.data.showContact && this.data.contact.trim()) {
        body.contact = this.data.contact.trim()
      }
      if (imageUrls.length > 0) {
        body.imageUrls = imageUrls
      }

      // 获取小程序 appId（前端可获取）
      try {
        const accountInfo = wx.getAccountInfoSync()
        body.subAppid = accountInfo.miniProgram.appId
      } catch (e) {
        // 获取失败时后端会自动填充
      }

      if (isCrossSchool) {
        // === 跨校发帖 ===
        // 重新获取最新额度，防止 onShow 中的异步加载尚未完成
        let currentQuota = quotaInfo
        let quotaOk = this.data.quotaLoaded
        try {
          currentQuota = await request({
            url: '/api/post/cross-school-quota/current',
            method: 'GET'
          })
          this.setData({ quotaInfo: currentQuota, quotaLoaded: true })
          quotaOk = true
        } catch (e) {
          console.warn('获取跨校额度失败:', e)
          if (!quotaOk) {
            // 额度从未加载成功，无法判断免费还是付费，终止发布
            wx.hideLoading()
            wx.showToast({ title: '获取跨校额度失败，请稍后重试', icon: 'none' })
            this.setData({ publishing: false })
            return
          }
          // 否则使用 onShow 中已加载的缓存值
        }

        if (currentQuota.remainingFreeCount > 0) {
          // 有免费额度：直接跨校发帖
          await request({
            url: '/api/post/publish/cross-school',
            method: 'POST',
            data: body
          })
          this.onPublishSuccess()
        } else {
          // 额度用完：发起跨校付费
          wx.showLoading({ title: '创建支付...', mask: true })
          let paymentResult
          try {
            paymentResult = await request({
              url: '/api/post/publish/cross-school/pay',
              method: 'POST',
              data: body
            })
          } catch (payErr) {
            wx.hideLoading()
            wx.showToast({ title: payErr.message || '创建支付失败', icon: 'none' })
            this.setData({ publishing: false })
            return
          }

          wx.hideLoading()
          // 拉起微信支付
          try {
            await this.confirmPayment(paymentResult.payParams, paymentResult.orderNo)
            wx.showToast({ title: '支付成功，帖子已发布', icon: 'success' })
            setTimeout(() => {
              safeNavigate({ url: '/pages/published/published?from=post' })
            }, 1500)
          } catch (payErr) {
            console.error('支付失败:', payErr)
            if (isPaymentCancelledError(payErr)) {
              wx.showToast({ title: '已取消支付', icon: 'none' })
            } else if (isPaymentProcessingError(payErr)) {
              wx.showModal({
                title: payErr.paymentSucceeded ? '支付成功' : '支付结果确认中',
                content: payErr.paymentSucceeded
                  ? '支付已经成功，帖子正在发布，请稍后刷新首页'
                  : payErr.message,
                showCancel: false,
                confirmText: '知道了',
                success: () => {
                  if (payErr.paymentSucceeded) {
                    safeNavigate({ url: '/pages/published/published?from=post' })
                  }
                }
              })
            } else {
              wx.showToast({ title: payErr.message || '支付失败', icon: 'none' })
            }
          }
        }
      } else {
        // === 本校发帖 ===
        if (buyLotteryTicket) {
          // 购买抽奖号码
          body.buyLotteryTicket = true
        }

        const result = await request({
          url: '/api/post/publish/local',
          method: 'POST',
          data: body
        })

        wx.hideLoading()

        if (result && result.needPay) {
          // 需要支付抽奖号码费用
          try {
            await this.confirmPayment(result.payParams, result.orderNo)
            wx.showToast({ title: '支付成功，抽奖号码已发放', icon: 'success' })
            setTimeout(() => {
              safeNavigate({ url: '/pages/published/published?from=post' })
            }, 1500)
          } catch (payErr) {
            console.error('支付失败:', payErr)
            // 帖子已发布（postId 已返回），仅抽奖号码未支付
            let message = payErr.message || '支付未完成，帖子已发布'
            if (isPaymentCancelledError(payErr)) message = '已取消支付，帖子已发布'
            if (payErr.paymentSucceeded) message = '支付成功，抽奖号码正在发放'
            wx.showToast({ title: message, icon: 'none' })
            // 即使支付失败，帖子已发布成功
            setTimeout(() => {
              safeNavigate({ url: '/pages/published/published?from=post' })
            }, 1500)
          }
        } else {
          // 无需支付，直接发布成功
          this.onPublishSuccess()
        }
      }
    } catch (err) {
      wx.hideLoading()
      console.error('发布帖子失败:', err)
      wx.showToast({ title: err.message || '发布失败，请重试', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  },

  /**
   * 发布成功的通用处理
   */
  onPublishSuccess() {
    wx.hideLoading()
    wx.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => {
      safeNavigate({ url: '/pages/published/published?from=post' })
    }, 1500)
  },

  /**
   * 发布二手挂单
   */
  async publishIdle() {
    const {
      selectedIdleType, selectedItemCategory,
      title, bookAuthor, bookPublisher, bookEdition, hasNotes,
      description, selectedConditionLevel, selectedDeliveryType,
      price, images
    } = this.data

    // 通用校验
    if (!selectedIdleType) {
      wx.showToast({ title: '请选择闲置类型', icon: 'none' })
      return
    }

    if (selectedIdleType === 'book') {
      // 二手书校验
      if (!title.trim()) {
        wx.showToast({ title: '请输入书名', icon: 'none' })
        return
      }
      if (hasNotes === null) {
        wx.showToast({ title: '请选择是否有笔记划线', icon: 'none' })
        return
      }
    } else {
      // 其他闲置校验
      if (!selectedItemCategory) {
        wx.showToast({ title: '请选择物品分类', icon: 'none' })
        return
      }
      if (!title.trim()) {
        wx.showToast({ title: '请输入物品名称', icon: 'none' })
        return
      }
    }

    if (!selectedDeliveryType) {
      wx.showToast({ title: '请选择交货方式', icon: 'none' })
      return
    }
    if (!selectedConditionLevel) {
      wx.showToast({ title: '请选择新旧程度', icon: 'none' })
      return
    }
    if (!price || parseFloat(price) <= 0) {
      wx.showToast({ title: '请输入有效售价', icon: 'none' })
      return
    }

    this.setData({ publishing: true })
    wx.showLoading({ title: '发布中...', mask: true })

    try {
      // 先上传图片
      const imageUrls = await this.uploadImages()

      if (selectedIdleType === 'book') {
        // 发布二手书
        const body = {
          title: title.trim(),
          price: parseFloat(price),
          conditionLevel: selectedConditionLevel,
          hasNotes: hasNotes,
          deliveryType: selectedDeliveryType
        }
        if (description.trim()) body.description = description.trim()
        if (bookAuthor.trim()) body.author = bookAuthor.trim()
        if (bookPublisher.trim()) body.publisher = bookPublisher.trim()
        if (bookEdition.trim()) body.edition = bookEdition.trim()
        if (imageUrls.length > 0) body.imageUrls = imageUrls

        await request({
          url: '/api/v1/idle/product/book',
          method: 'POST',
          data: body
        })
      } else {
        // 发布其他闲置
        const body = {
          title: title.trim(),
          category: selectedItemCategory,
          price: parseFloat(price),
          conditionLevel: selectedConditionLevel,
          deliveryType: selectedDeliveryType
        }
        if (description.trim()) body.description = description.trim()
        if (imageUrls.length > 0) body.imageUrls = imageUrls

        await request({
          url: '/api/v1/idle/product/item',
          method: 'POST',
          data: body
        })
      }

      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        safeNavigate({ url: '/pages/published/published?from=post' })
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('发布闲置失败:', err)
      wx.showToast({ title: err.message || '发布失败，请重试', icon: 'none' })
    } finally {
      this.setData({ publishing: false })
    }
  }
})
