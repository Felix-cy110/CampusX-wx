const mock = require('../../utils/mock.js')
Page({
  data: { users: [] },
  onLoad() {
    this.setData({ users: mock.purchasedBy })
  }
})
