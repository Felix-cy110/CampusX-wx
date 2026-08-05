const { request } = require('../../utils/request')
const mock = require('../../utils/mock')

Page({
  data: {
    searchText: '',
    campusId: null,
    departmentList: [],
    filteredDepartmentList: [],
    currentMajors: [],
    selectedDeptIndex: 0,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight
    })

    // 从 storage 读取已选学校，获取 campusId
    const schoolData = wx.getStorageSync('selectedSchool')
    if (schoolData) {
      try {
        const school = JSON.parse(schoolData)
        this.setData({ campusId: school.id })
        this.fetchDepartments(school.id)
      } catch (e) {
        console.error('解析学校数据失败:', e)
      }
    }
  },

  // 获取院系列表（mock 阶段直接使用本地数据）
  fetchDepartments(campusId) {
    wx.showLoading({ title: '加载中...' })
    request({
      url: '/api/v1/department/list',
      method: 'GET',
      data: { campusId }
    }).then(list => {
      wx.hideLoading()
      const departmentList = (list || []).map(dept => ({
        id: dept.id,
        name: dept.name,
        majors: []
      }))
      this.setData({
        departmentList,
        filteredDepartmentList: departmentList,
        currentMajors: []
      })
      if (departmentList.length > 0) {
        this.fetchMajors(0, departmentList[0].id)
      }
    }).catch(err => {
      wx.hideLoading()
      console.log('获取院系列表失败，使用 mock 数据:', err)
      const departmentList = (mock.departmentMajorMap || []).map(dept => ({
        id: dept.id,
        name: dept.name,
        majors: dept.majors || []
      }))
      this.setData({
        departmentList,
        filteredDepartmentList: departmentList,
        currentMajors: []
      })
      if (departmentList.length > 0) {
        this.setData({ currentMajors: departmentList[0].majors })
      }
    })
  },

  // 获取专业列表（mock 阶段直接使用本地数据）
  fetchMajors(deptIndex, departmentId) {
    request({
      url: '/api/v1/major/list',
      method: 'GET',
      data: { departmentId }
    }).then(list => {
      const majors = (list || []).map(m => ({
        id: m.id,
        name: m.name,
        departmentId: m.departmentId
      }))
      const departmentList = this.data.departmentList.map((dept, idx) => {
        if (idx === deptIndex) {
          return { ...dept, majors }
        }
        return dept
      })
      this.setData({
        departmentList,
        currentMajors: majors
      })
    }).catch(err => {
      console.log('获取专业列表失败，使用 mock 数据:', err)
      const dept = this.data.departmentList[deptIndex]
      const majors = (dept && dept.majors) ? dept.majors : []
      const departmentList = this.data.departmentList.map((d, idx) => {
        if (idx === deptIndex) {
          return { ...d, majors }
        }
        return d
      })
      this.setData({
        departmentList,
        currentMajors: majors
      })
    })
  },

  // 切换院系
  selectDept(e) {
    const index = e.currentTarget.dataset.index
    const dept = this.data.departmentList[index]
    if (!dept) return

    this.setData({ selectedDeptIndex: index })

    // 如果该院系的专业尚未加载，则加载
    if (dept.majors.length === 0) {
      this.fetchMajors(index, dept.id)
    } else {
      this.setData({ currentMajors: dept.majors })
    }
  },

  // 搜索
  onSearch(e) {
    const searchText = e.detail.value.trim()
    this.setData({ searchText })

    if (!searchText) {
      this.setData({ filteredDepartmentList: this.data.departmentList })
      return
    }

    // 过滤院系
    const filtered = this.data.departmentList
      .map(dept => ({
        ...dept,
        majors: dept.majors.filter(major =>
          major.name.includes(searchText)
        )
      }))
      .filter(dept => dept.majors.length > 0)

    this.setData({ filteredDepartmentList: filtered })
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchText: '',
      filteredDepartmentList: this.data.departmentList
    })
  },

  // 选择专业
  selectMajor(e) {
    const majorId = e.currentTarget.dataset.id
    const majorName = e.currentTarget.dataset.name
    const dept = this.data.departmentList[this.data.selectedDeptIndex]

    // 传递 { departmentId, departmentName, majorId, majorName }
    const data = JSON.stringify({
      departmentId: dept ? dept.id : null,
      departmentName: dept ? dept.name : '',
      majorId,
      majorName
    })
    wx.setStorageSync('selectedMajor', data)
    wx.navigateBack({ delta: 1 })
  },

  // 返回
  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
