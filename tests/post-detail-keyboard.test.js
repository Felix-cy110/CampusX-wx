const test = require('node:test')
const assert = require('node:assert/strict')

let pageDefinition

global.getApp = function () { return { globalData: {} } }
global.Page = function (definition) { pageDefinition = definition }

require('../pages/post-detail/post-detail')

function createPage(data) {
  return {
    data: Object.assign({}, pageDefinition.data, data),
    setData(updates, callback) {
      Object.assign(this.data, updates)
      if (callback) callback()
    },
    resetCommentKeyboardLayout: pageDefinition.resetCommentKeyboardLayout,
    ensureReplyTargetVisible() {}
  }
}

test('键盘高度变化会缩小并恢复帖子详情页', function () {
  const page = createPage()

  pageDefinition.onCommentKeyboardHeightChange.call(page, { detail: { height: 320 } })
  assert.equal(page.data.keyboardHeight, 320)

  pageDefinition.onCommentKeyboardHeightChange.call(page, { detail: { height: 0 } })
  assert.equal(page.data.keyboardHeight, 0)
})

test('输入框失焦时兜底清零键盘高度', function () {
  const page = createPage({ commentInputFocus: true, keyboardHeight: 320 })

  pageDefinition.onCommentBlur.call(page)

  assert.equal(page.data.commentInputFocus, false)
  assert.equal(page.data.keyboardHeight, 0)
})

test('页面离开时不会保留键盘占位状态', function () {
  const page = createPage({ commentInputFocus: true, keyboardHeight: 320 })

  pageDefinition.onHide.call(page)

  assert.equal(page.data.commentInputFocus, false)
  assert.equal(page.data.keyboardHeight, 0)
})
