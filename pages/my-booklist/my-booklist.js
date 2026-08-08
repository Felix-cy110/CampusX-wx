const { request } = require('../../utils/request')

const DEFAULT_COVER = '/images/avatars/default.png'
const SEMESTER_ORDER = ['大一上', '大一下', '大二上', '大二下', '大三上', '大三下', '大四上', '大四下']

Page({
  data: {
    booklist: [],
    semesters: [],
    currentBooks: [],
    selectedIndex: 0,
    searchValue: '',
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

    request({
      url: '/api/v1/textbook/major',
      method: 'GET'
    })
      .then(data => {
        const voList = Array.isArray(data) ? data : []
        const books = voList.map(this.mapBook)
        const semSet = new Set(books.map(b => b.semesterLabel))
        const semesters = SEMESTER_ORDER.filter(s => semSet.has(s))
        semSet.forEach(s => { if (!semesters.includes(s)) semesters.push(s) })
        const currentSemester = semesters[0] || ''
        this.setData({
          booklist: books,
          semesters,
          currentBooks: books.filter(b => b.semesterLabel === currentSemester),
          selectedIndex: 0
        })
      })
      .catch(() => {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
        this.setData({ booklist: [], semesters: [], currentBooks: [] })
      })
  },

  mapBook(vo) {
    const course = (vo.courses && vo.courses[0]) || {}
    const gradeLabels = { 1: '大一', 2: '大二', 3: '大三', 4: '大四' }
    const semLabels = { 1: '上', 2: '下' }
    const semesterLabel = ((gradeLabels[course.grade] || '') + (semLabels[course.semester] || '')) || ''
    return {
      title: vo.title,
      publisher: vo.publisher,
      cover: DEFAULT_COVER,
      author: vo.author,
      isbn: vo.isbn,
      semesterLabel,
      courses: vo.courses || []
    }
  },

  selectSemester(e) {
    const index = e.currentTarget.dataset.index
    const semester = this.data.semesters[index]
    this.setData({ selectedIndex: index, currentBooks: this.data.booklist.filter(b => b.semesterLabel === semester) })
  },

  navigateBack() {
    wx.navigateBack()
  },

  onSearchInput(e) {
    const value = e.detail.value
    this.setData({ searchValue: value })
    if (value) {
      this.setData({ currentBooks: this.data.booklist.filter(b => b.title.indexOf(value) >= 0 || b.publisher.indexOf(value) >= 0) })
    } else {
      const semester = this.data.semesters[this.data.selectedIndex]
      this.setData({ currentBooks: this.data.booklist.filter(b => b.semesterLabel === semester) })
    }
  }
})
