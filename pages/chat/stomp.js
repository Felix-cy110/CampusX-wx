/**
 * 轻量级 STOMP over WebSocket 客户端（微信小程序专用）
 *
 * 用法:
 *   const client = createStompClient({
 *     url: 'wss://xixutech.cn/ws',
 *     token: 'your-jwt-token',
 *     onMessage: (msg) => { ... },
 *     onConnected: () => { ... },
 *     onError: (err) => { ... }
 *   })
 *   client.connect()
 *   client.subscribe('/queue/user/123', callback)
 *   client.send('/app/chat/456/send', { receiverId: 456, ... })
 *   client.disconnect()
 */

/**
 * 计算字符串的 UTF-8 字节长度
 * STOMP content-length header 必须填字节数，不能用 JS 的 .length（UTF-16 码元数）
 */
function utf8ByteLength(str) {
  var len = 0
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i)
    if (code < 0x80) {
      len += 1
    } else if (code < 0x800) {
      len += 2
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      len += 4
      i++  // 跳过低代理位
    } else {
      len += 3
    }
  }
  return len
}

/**
 * 字符串转 ArrayBuffer（UTF-8 编码）
 * 微信小程序 WebSocket 发送字符串时会截断 \0（null 字符），
 * 因此必须用二进制方式发送 STOMP 帧，以保留帧末尾的 null 终止符。
 *
 * 注意：不能用 str.length + charCodeAt(i) & 0xFF 的简化写法，
 * 那会破坏所有非 ASCII 字符（中文等）。必须按 UTF-8 规则正确编码。
 */
function stringToArrayBuffer(str) {
  // 第一遍：计算 UTF-8 字节长度
  var utf8len = 0
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i)
    if (code < 0x80) {
      utf8len += 1
    } else if (code < 0x800) {
      utf8len += 2
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      // 高位代理对（emoji 等），需要 4 字节 + 跳过低位
      utf8len += 4
      i++
    } else {
      utf8len += 3
    }
  }

  var buf = new ArrayBuffer(utf8len)
  var view = new Uint8Array(buf)
  var offset = 0

  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i)

    // 处理代理对（高位 + 低位 → 真实码点）
    if (code >= 0xD800 && code <= 0xDBFF) {
      var high = code
      var low = str.charCodeAt(++i)
      code = ((high - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000
    }

    if (code < 0x80) {
      // 1 字节：0xxxxxxx
      view[offset++] = code
    } else if (code < 0x800) {
      // 2 字节：110xxxxx 10xxxxxx
      view[offset++] = 0xC0 | (code >> 6)
      view[offset++] = 0x80 | (code & 0x3F)
    } else if (code < 0x10000) {
      // 3 字节：1110xxxx 10xxxxxx 10xxxxxx（中文在此范围）
      view[offset++] = 0xE0 | (code >> 12)
      view[offset++] = 0x80 | ((code >> 6) & 0x3F)
      view[offset++] = 0x80 | (code & 0x3F)
    } else {
      // 4 字节：11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      view[offset++] = 0xF0 | (code >> 18)
      view[offset++] = 0x80 | ((code >> 12) & 0x3F)
      view[offset++] = 0x80 | ((code >> 6) & 0x3F)
      view[offset++] = 0x80 | (code & 0x3F)
    }
  }

  return buf
}

/**
 * ArrayBuffer 转字符串（UTF-8 解码）
 * 用于接收服务端返回的二进制帧，正确还原中文等多字节字符
 */
function arrayBufferToString(buf) {
  if (typeof buf === 'string') return buf
  var bytes = new Uint8Array(buf)
  var str = ''
  var i = 0
  while (i < bytes.length) {
    var byte1 = bytes[i++]
    if (byte1 < 0x80) {
      // 1 字节
      str += String.fromCharCode(byte1)
    } else if ((byte1 & 0xE0) === 0xC0) {
      // 2 字节
      var byte2 = bytes[i++]
      str += String.fromCharCode(((byte1 & 0x1F) << 6) | (byte2 & 0x3F))
    } else if ((byte1 & 0xF0) === 0xE0) {
      // 3 字节（中文）
      var byte2 = bytes[i++]
      var byte3 = bytes[i++]
      str += String.fromCharCode(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F))
    } else if ((byte1 & 0xF8) === 0xF0) {
      // 4 字节 → 代理对
      var byte2 = bytes[i++]
      var byte3 = bytes[i++]
      var byte4 = bytes[i++]
      var codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F)
      codePoint -= 0x10000
      str += String.fromCharCode(0xD800 + (codePoint >> 10), 0xDC00 + (codePoint & 0x3FF))
    }
  }
  return str
}

/**
 * 构建 STOMP 帧
 * 格式: COMMAND\nheader1:value1\n\nbody\0
 */
function buildFrame(command, headers, body) {
  var frame = command + '\n'
  if (headers) {
    var keys = Object.keys(headers)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      var val = headers[key]
      if (val !== undefined && val !== null) {
        frame += key + ':' + val + '\n'
      }
    }
  }
  frame += '\n'
  if (body) {
    frame += body
  }
  frame += '\0'
  return frame
}

/**
 * 解析 STOMP 帧
 */
function parseFrame(frameStr) {
  var lines = frameStr.split('\n')
  if (lines.length === 0) return null

  var command = lines[0].trim()
  var headers = {}
  var bodyStart = 1

  for (var i = 1; i < lines.length; i++) {
    var line = lines[i]
    if (line === '') {
      bodyStart = i + 1
      break
    }
    var colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      headers[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim()
    }
  }

  var body = lines.slice(bodyStart).join('\n').trim()

  return { command: command, headers: headers, body: body }
}

/**
 * 创建 STOMP 客户端
 */
function createStompClient(options) {
  var url = options.url
  var token = options.token
  var debug = options.debug || false
  var onConnected = options.onConnected || function () { }
  var onMessage = options.onMessage || function () { }
  var onError = options.onError || function () { }

  var socketTask = null
  var connected = false
  var subIdCounter = 0
  var subscriptions = {}
  var frameBuffer = ''
  var heartbeatTimer = null

  function log(msg) {
    if (debug) console.log('[STOMP] ' + msg)
  }

  /** 发送原始帧数据（使用 ArrayBuffer 保留 \0 终止符） */
  function sendRaw(data) {
    if (socketTask) {
      var buf = stringToArrayBuffer(data)
      socketTask.send({ data: buf })
    }
  }

  /** 处理接收到的 STOMP 帧 */
  function processFrame(frameStr) {
    var frame = parseFrame(frameStr)
    if (!frame) return

    log('RECV ' + frame.command)

    if (frame.command === 'CONNECTED') {
      connected = true
      log('STOMP connected')
      onConnected()
    } else if (frame.command === 'MESSAGE') {
      var subId = frame.headers['subscription']
      var sub = subscriptions[subId]
      var parsedBody = frame.body
      try {
        parsedBody = JSON.parse(frame.body)
      } catch (e) { /* keep as string */ }
      if (sub && sub.callback) {
        sub.callback(parsedBody, frame.headers)
      }
      onMessage(parsedBody, frame.headers)
    } else if (frame.command === 'ERROR') {
      console.error('[STOMP] Error frame:', frame.body)
      console.error('[STOMP] Error headers:', JSON.stringify(frame.headers))
      // Spring STOMP 通常在 message header 中携带错误详情
      var errMsg = frame.headers['message'] || frame.body || 'STOMP Error'
      onError(new Error(errMsg))
    } else if (frame.command === 'RECEIPT') {
      log('Receipt: ' + (frame.headers['receipt-id'] || ''))
    }
  }

  /** 发送心跳（同样使用 ArrayBuffer 发送，保持一致性） */
  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(function () {
      if (connected && socketTask) {
        try {
          var buf = stringToArrayBuffer('\n')
          socketTask.send({ data: buf })
        } catch (e) { }
      }
    }, 10000)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /** 连接到 WebSocket 并完成 STOMP 握手 */
  function connect() {
    if (socketTask) {
      disconnect()
    }

    log('Connecting to ' + url)

    socketTask = wx.connectSocket({
      url: url,
      success: function () {
        log('Socket task created')
      },
      fail: function (err) {
        console.error('[STOMP] Connect socket failed:', err)
        onError(err)
      }
    })

    socketTask.onOpen(function () {
      log('WebSocket opened, sending CONNECT')
      var connectHeaders = {
        'accept-version': '1.0,1.1,2.0',
        'heart-beat': '10000,10000'
      }
      if (token) {
        connectHeaders['Authorization'] = 'Bearer ' + token
      }
      var frame = buildFrame('CONNECT', connectHeaders)
      sendRaw(frame)
    })

    socketTask.onMessage(function (res) {
      // 兼容文本和二进制两种响应格式
      var data = arrayBufferToString(res.data)
      // 过滤 STOMP 心跳（纯换行符），避免污染 frameBuffer
      if (data === '\n' || data === '\r\n') {
        log('Heartbeat received')
        return
      }
      frameBuffer += data
      // STOMP 帧以 null 字符结尾
      var idx
      while ((idx = frameBuffer.indexOf('\0')) !== -1) {
        var frameStr = frameBuffer.substring(0, idx)
        frameBuffer = frameBuffer.substring(idx + 1)
        // 去除帧前可能残留的心跳换行符（心跳已在 onMessage 被过滤，
        // 这里仅兜底处理极端情况；绝对不能 strip 末尾换行，会破坏
        // STOMP 帧 header 与 body 之间的空行分隔符）
        frameStr = frameStr.replace(/^[\r\n]+/, '')
        if (frameStr.trim()) {
          processFrame(frameStr)
        }
      }
    })

    socketTask.onClose(function () {
      log('WebSocket closed')
      connected = false
      stopHeartbeat()
    })

    socketTask.onError(function (err) {
      console.error('[STOMP] WebSocket error:', err)
      onError(err)
    })
  }

  /** 订阅目标地址 */
  function subscribe(destination, callback) {
    var id = 'sub-' + (subIdCounter++)
    subscriptions[id] = { destination: destination, callback: callback }
    var frame = buildFrame('SUBSCRIBE', { id: id, destination: destination, ack: 'auto' })
    sendRaw(frame)
    return id
  }

  /** 取消订阅 */
  function unsubscribe(id) {
    delete subscriptions[id]
    var frame = buildFrame('UNSUBSCRIBE', { id: id })
    sendRaw(frame)
  }

  /** 发送消息到目标地址 */
  function send(destination, body) {
    var bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    var headers = {
      destination: destination,
      'content-type': 'application/json',
      // content-length 必须是 UTF-8 字节数，不能用 .length（中文一个字符 = 3 字节）
      'content-length': String(utf8ByteLength(bodyStr))
    }
    var frame = buildFrame('SEND', headers, bodyStr)
    sendRaw(frame)
  }

  /** 断开连接 */
  function disconnect() {
    stopHeartbeat()
    if (socketTask && connected) {
      try {
        var frame = buildFrame('DISCONNECT', {})
        sendRaw(frame)
      } catch (e) { }
    }
    connected = false
    // 清空订阅
    var subKeys = Object.keys(subscriptions)
    for (var j = 0; j < subKeys.length; j++) {
      delete subscriptions[subKeys[j]]
    }
    if (socketTask) {
      try {
        socketTask.close()
      } catch (e) { }
      socketTask = null
    }
  }

  /** 是否已连接 */
  function isConnected() {
    return connected && socketTask !== null
  }

  // 返回客户端 API
  return {
    connect: connect,
    disconnect: disconnect,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    send: send,
    isConnected: isConnected
  }
}

module.exports = { createStompClient }
