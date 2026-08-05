const { BASE_URL } = require('./config')

function request(options) {
  const token = wx.getStorageSync('token')
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + options.url,
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
          reject(res.data)
        }
      },
      fail: reject
    })
  })
}

/**
 * 将后端返回的相对路径转为完整 URL
 * @param {string} path - 相对路径，如 /images/xxx.png
 * @returns {string} 完整 URL，如 http://localhost:5659/images/xxx.png
 */
function toFullUrl(path) {
  if (!path) return ''
  // 已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  // 相对路径，拼接 BASE_URL
  if (path.startsWith('/')) return BASE_URL + path
  return path
}

module.exports = { request, BASE_URL, toFullUrl }
