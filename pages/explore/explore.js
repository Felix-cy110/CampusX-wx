const app = getApp()
const { safeNavigate } = require('../../utils/safeNavigate')

Page({
  data: {
    isJoinedSchool: true,
    _scrollTop: 0,

    /* 自定义导航栏尺寸 */
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    /* 计算自定义导航栏尺寸，与胶囊按钮对齐 */
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      isJoinedSchool: app.globalData.isJoinedSchool
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  /* 双击 tab 回到顶部 */
  scrollToTop() {
    this.setData({ _scrollTop: this.data._scrollTop ? 0 : 1 })
  },

  /* 图书预购 */
  onTapBookPreorder() {
    safeNavigate({ url: '/pages/book-preorder/book-preorder' })
  },

  /* 邀请新人有奖 */
  onTapInvite() {
    safeNavigate({ url: '/pages/invite/invite' })
  }
})
