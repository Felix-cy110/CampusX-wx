const { getBaseUrl } = require('./config')
const { handleAuthFailure } = require('./auth')

function request(options) {
  const token = wx.getStorageSync('token')
  return new Promise((resolve, reject) => {
    wx.request({
      url: getBaseUrl() + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      success(res) {
        if (res.data && res.data.code === 200) {
          resolve(res.data.data)
        } else {
          const error = res.data || {
            code: res.statusCode,
            statusCode: res.statusCode,
            message: '请求失败'
          }
          // 只允许当前请求所属的会话清理登录态，避免旧请求迟到后误删新 Token
          handleAuthFailure(error, token)
          reject(error)
        }
      },
      fail: reject
    })
  })
}

/**
 * 将后端返回的相对路径转为完整 URL
 * @param {string} path - 相对路径，如 /images/xxx.png
 * @returns {string} 完整 URL
 */
function toFullUrl(path) {
  if (!path) return ''
  const value = String(path).trim()
  if (!value) return ''

  // 历史数据里曾保存过 localhost 地址。真机无法访问开发机 localhost，
  // 将这类地址恢复成当前环境的公网后端地址。
  const localPath = value.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)?$/i)
  if (localPath) return getBaseUrl() + (localPath[1] || '')

  // 已经是完整 URL，直接返回
  // 不使用 String.prototype.startsWith，兼容部分安卓微信 JS 运行环境。
  if (/^https?:\/\//i.test(value)) return value
  // 相对路径，拼接当前环境的后端地址
  if (value.charAt(0) === '/') return getBaseUrl() + value
  return value
}

module.exports = { request, getBaseUrl, toFullUrl }
