const { safeNavigate } = require('../../utils/safeNavigate')
const { request } = require('../../utils/request')

Page({
  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
    this.setData({ statusBarHeight, navBarHeight })

    // 如果携带了教师和课程参数，直接预选进入评分表单
    const teacherId = options.teacherId
    const teacherName = options.teacherName
    if (teacherId && teacherName) {
      this.setData({
        selectedTeacher: {
          id: teacherId,
          name: decodeURIComponent(teacherName),
          avgScore: decodeURIComponent(options.teacherAvgScore || ''),
          ratingCount: parseInt(options.teacherRatingCount) || 0
        },
        selectedCourse: {
          id: options.courseId || '',
          courseName: decodeURIComponent(options.courseName || ''),
          avgScore: decodeURIComponent(options.courseAvgScore || '')
        }
      })
      return
    }

    // 否则加载本校教师列表供搜索选择
    this.doSearch('')
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 0,

    // 教师搜索
    keyword: '',
    teachers: [],
    searching: false,
    searched: false,

    // 选中的教师和课程
    selectedTeacher: null,   // TeacherWithRatingVO
    selectedCourse: null,    // TeacherCourseVO

    // 评分
    stars: [1, 2, 3, 4, 5],
    score: 0,
    content: '',
    contentMax: 500,

    submitting: false
  },

  goBack() {
    wx.navigateBack()
  },

  goApplyTeacher() {
    safeNavigate({ url: '/pages/apply-teacher/apply-teacher' })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearchConfirm() {
    this.doSearch(this.data.keyword.trim())
  },

  onSearchClear() {
    this.setData({ keyword: '' })
    this.doSearch('')
  },

  doSearch(keyword) {
    this.setData({ searching: true, searched: false, teachers: [] })

    request({
      url: '/api/v1/teacher/search',
      method: 'GET',
      data: { keyword, pageSize: 10 }
    }).then(data => {
      const list = (data && data.list) ? data.list : []
      this.setData({
        teachers: list,
        searching: false,
        searched: true
      })
      if (list.length === 0) {
        wx.showToast({ title: '未找到相关教师', icon: 'none' })
      }
    }).catch(err => {
      console.error('搜索教师失败:', err)
      this.setData({ searching: false, searched: true })
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
    })
  },

  /**
   * 点击教师行：切换展开/收起课程列表
   */
  selectTeacher(e) {
    const index = e.currentTarget.dataset.index
    const teacher = this.data.teachers[index]
    const currentExpanded = this.data.expandedTeacherIndex

    if (currentExpanded === index) {
      // 再次点击同一教师，收起
      this.setData({ expandedTeacherIndex: -1 })
    } else {
      this.setData({ expandedTeacherIndex: index })
    }
  },

  /**
   * 选择一个课程，进入评分表单
   */
  selectCourse(e) {
    const tIndex = e.currentTarget.dataset.tIndex
    const cIndex = e.currentTarget.dataset.cIndex
    const teacher = this.data.teachers[tIndex]
    const course = teacher.courses[cIndex]

    this.setData({
      selectedTeacher: teacher,
      selectedCourse: course,
      keyword: '',
      teachers: [],
      searched: false,
      expandedTeacherIndex: -1
    })
  },

  /**
   * 取消已选择的教师/课程，重新加载本校教师列表
   */
  clearSelection() {
    this.setData({
      selectedTeacher: null,
      selectedCourse: null,
      score: 0,
      content: '',
      keyword: ''
    })
    this.doSearch('')
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  setScore(e) {
    const score = e.currentTarget.dataset.score
    this.setData({ score })
  },

  async onSubmit() {
    const { selectedTeacher, selectedCourse, score, content, submitting } = this.data

    if (submitting) return

    if (!selectedTeacher || !selectedCourse) {
      wx.showToast({ title: '请先选择教师和课程', icon: 'none' })
      return
    }
    if (score === 0) {
      wx.showToast({ title: '请选择评分', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '发布中...', mask: true })

    try {
      const body = {
        teacherId: selectedTeacher.id,
        teacherCourseId: selectedCourse.id,
        score: score
      }
      if (content.trim()) {
        body.content = content.trim()
      }

      await request({
        url: '/api/v1/teacher/rating',
        method: 'POST',
        data: body
      })

      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/published/published?from=rating' })
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      console.error('发布评分失败:', err)
      wx.showToast({ title: err.message || '发布失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
