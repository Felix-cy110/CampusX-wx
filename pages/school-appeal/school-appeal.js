const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')
const { request, toFullUrl, getBaseUrl } = require('../../utils/request')
const { handleAuthFailure } = require('../../utils/auth')

Page({
  data: {
    reason: '',
    idImages: [],
    targetSchool: '',
    targetMajor: '',
    targetCampusId: null,
    targetMajorId: null,
    submitting: false,
    appealList: [],
    loadingAppeals: false
  },

  onLoad() {
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      targetSchool: userInfo.school || '',
      targetMajor: userInfo.major || '',
      targetCampusId: userInfo.campusId || null,
      targetMajorId: userInfo.majorId || null
    })
  },

  onShow() {
    const selectedSchool = wx.getStorageSync('selectedSchool')
    const selectedMajor = wx.getStorageSync('selectedMajor')
    if (selectedSchool) {
      try {
        const school = typeof selectedSchool === 'string' ? JSON.parse(selectedSchool) : selectedSchool
        this.setData({ targetSchool: school.name || '', targetCampusId: school.id || null })
      } catch (e) { /* 忽略脏数据 */ }
      wx.removeStorageSync('selectedSchool')
    }
    if (selectedMajor) {
      try {
        const major = typeof selectedMajor === 'string' ? JSON.parse(selectedMajor) : selectedMajor
        this.setData({
          targetMajor: major.majorName || '',
          targetMajorId: major.majorId || null
        })
      } catch (e) { /* 忽略脏数据 */ }
      wx.removeStorageSync('selectedMajor')
    }
    this.loadAppealList()
    this.refreshCurrentUser()
  },

  /* 管理员可能在用户停留期间通过申诉，每次进入页面都刷新全局用户缓存。 */
  refreshCurrentUser() {
    const token = wx.getStorageSync('token')
    if (token && typeof app.validateStoredSession === 'function') {
      app.validateStoredSession(token)
    }
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  addImage() {
    if (this.data.idImages.length >= 2) return
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ idImages: this.data.idImages.concat(res.tempFilePaths) })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.idImages
    images.splice(index, 1)
    this.setData({ idImages: images })
  },

  selectSchool() {
    safeNavigate({ url: '/pages/select-school/select-school' })
  },

  selectMajor() {
    if (!this.data.targetCampusId) {
      wx.showToast({ title: '请先选择高校', icon: 'none' })
      return
    }
    // 将当前已选学校写入 storage，供 select-major 页面读取（与 complete-info 一致）
    wx.setStorageSync('selectedSchool', JSON.stringify({
      id: this.data.targetCampusId,
      name: this.data.targetSchool
    }))
    safeNavigate({ url: '/pages/select-major/select-major' })
  },

  /* 兼容 ISO 字符串与 [y,m,d,h,min,s] 数组 */
  formatDateTime(value) {
    if (!value) return ''
    const pad = (n) => String(n).padStart(2, '0')
    if (Array.isArray(value)) {
      const [y, m, d, h = 0, min = 0, s = 0] = value
      return `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(min)}:${pad(s)}`
    }
    if (typeof value === 'string') {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      }
    }
    return String(value)
  },

  getStatusClass(status) {
    if (status === 0) return 'tag-orange'
    if (status === 1) return 'tag-green'
    return 'tag-red'
  },

  async loadAppealList() {
    this.setData({ loadingAppeals: true })
    try {
      const list = await request({
        url: '/api/v1/user/school-appeal/list',
        method: 'GET'
      })
      const appealList = (Array.isArray(list) ? list : []).map((item) => ({
        ...item,
        status: Number(item.status),
        studentCardFullUrl: toFullUrl(item.studentCardUrl),
        idCardFullUrl: toFullUrl(item.idCardUrl),
        createdAtText: this.formatDateTime(item.createdAt),
        statusClass: this.getStatusClass(Number(item.status))
      }))
      this.setData({ appealList, loadingAppeals: false })
    } catch (err) {
      this.setData({ loadingAppeals: false })
      console.error('加载申诉记录失败', err)
      wx.showToast({ title: (err && err.message) || '加载申诉记录失败', icon: 'none' })
    }
  },

  /* 上传单张图片，返回后端相对路径 */
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
        fail: () => reject(new Error('上传请求失败'))
      })
    })
  },

  async onSubmit() {
    if (this.data.submitting) return
    const { reason, idImages, targetCampusId, targetMajorId } = this.data

    if (!reason.trim()) {
      wx.showToast({ title: '请输入申诉原因', icon: 'none' })
      return
    }
    if (idImages.length < 2) {
      wx.showToast({ title: '请上传学生证和身份证照片', icon: 'none' })
      return
    }
    if (!targetCampusId || !targetMajorId) {
      wx.showToast({ title: '请选择目标高校和专业', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    try {
      // 第 1 张学生证、第 2 张身份证（后端字段限制）
      const urls = []
      for (const filePath of idImages) {
        urls.push(await this.uploadImage(filePath))
      }
      await request({
        url: '/api/v1/user/school-appeal/submit',
        method: 'POST',
        data: {
          targetCampusId,
          targetMajorId,
          studentCardUrl: urls[0],
          idCardUrl: urls[1],
          reason: reason.trim()
        }
      })
      wx.hideLoading()
      wx.showToast({ title: '申诉已提交', icon: 'success' })
      setTimeout(() => { wx.navigateBack() }, 1500)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '提交失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})
