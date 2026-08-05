# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CampusX 是一个校园社交微信小程序。数据来源混合：已对接后端的页面使用 `utils/request.js`（封装 `wx.request`）调用后端 API，未对接的页面仍使用 `utils/mock.js` mock 数据。

后端为 Spring Boot 项目，端口 **5659**，API 前缀 `/api/v1`。小程序通过 `utils/config.js` 中的 `BASE_URL` 连接后端（开发环境默认 `http://localhost:5659`）。**注意：后端代码不在本仓库中**，本仓库仅包含微信小程序前端。

### 请求工具 (`utils/request.js`)

封装 `wx.request`，自动注入 `Authorization: Bearer <token>`，统一处理响应：
- 后端成功响应码为 **200**（`ResultCodeEnum.SUCCESS`），`code === 200` 时 resolve 为 `res.data.data`
- 认证 token 存储在 `wx.getStorageSync('token')`
- `toFullUrl(path)` — 将后端返回的相对路径（如 `/images/xxx.png`）转为完整 URL（`http://localhost:5659/images/xxx.png`）。**所有来自后端图片路径都必须通过此函数转换后才能显示**

### 已对接后端的页面/功能

| 页面/功能 | 调用的 API | 状态 |
|-----------|-----------|------|
| `publish-post`（图文帖子） | `/api/post/publish/local`、`/api/post/publish/cross-school` 等 | ✅ |
| `publish-post`（二手挂单） | `/api/v1/idle/product/book`、`/api/v1/idle/product/item` | ✅ |
| 图片上传 | `/api/v1/upload/image` | ✅ |
| 跑腿列表/详情/抢单 | `/api/v1/errand/*` | ✅ |
| 幸运抽奖/邀请有奖 | `/api/v1/lottery/*`（见 `utils/api/lottery.js`） | ✅ |
| 帖子列表点赞 | `/api/v1/post/*/like` | ✅ |
| 通知未读数 | `/api/v1/notification/count` | ✅ |
| 聊天（STOMP WebSocket） | `/ws` | ✅ |

### 仍使用 Mock 数据的部分

以下模块后端已实现，但小程序端尚未全部对接，仍使用 `utils/mock.js` 数据：
- 首页帖子列表、二手市场列表、评分列表（部分已对接，混合使用）
- 详情页（商品/组队/评分详情）
- 搜索、通知内容列表

## 开发方式

- 使用**微信开发者工具**打开项目根目录，编译和预览均由开发者工具自动完成
- 无 npm 依赖、无构建脚本、无 TypeScript 编译 —— 修改 `.js`/`.wxml`/`.wxss`/`.json` 后直接在开发者工具中查看效果
- `project.config.json` 中已启用 ES6→ES5、postcss、WXSS/WXML 压缩，基础库版本 `3.15.2`
- 开发时 `project.private.config.json` 中 `urlCheck: false`，热重载已开启
- 全局网络超时 60s（`app.json` 中 `networkTimeout`）

## 全局架构

### 全局状态 (`app.js`)

所有跨页面共享状态存放在 `app.globalData`：

| 字段 | 用途 |
|---|---|
| `isLoggedIn` | 登录状态 |
| `isJoinedSchool` | 是否已加入学校 |
| `userInfo` | 当前用户信息（uid、昵称、头像、学校、专业、入学年份、邀请码、stats 等） |
| `crossSchoolQuota` | 跨校发帖额度 |
| `notificationCounts` | 收件箱各类型未读数量缓存（likes/followers/comments/system/chatUnread） |
| `_notificationCountsLoaded` | 标记 notificationCounts 是否已被 API 填充（防止首次加载时用初始零值覆盖 badge） |
| `_notificationReadSent` | 乐观更新追踪：记录本地已标记已读但后端可能尚未确认的类型 |
| `_pendingChatDecrement` | 聊天未读的乐观扣减量 |
| `_tabBar` | 指向当前 tabBar 组件实例，供非 tab 页刷新 badge 使用 |

页面间传递数据使用 `wx.setStorageSync`/`wx.getStorageSync`（如 `selectedSchool`、`selectedMajor`、`currentErrand`）。

### 设计系统 (`app.wxss`)

35 个 CSS 自定义属性定义在 `page {}` 上，所有页面通过 `var(--color-xxx)` 引用：

- 主色：`--color-primary: #255AC5`
- 语义色：`--color-red`、`--color-green`、`--color-orange`、`--color-purple`、`--color-gold` 等
- 字号阶梯：`--font-xs`(20rpx) ~ `--font-3xl`(48rpx)，以及 `--font-title`(72rpx)、`--font-giant`(96rpx)
- 圆角：`--radius-sm`(8rpx)、`--radius-md`(16rpx)、`--radius-lg`(24rpx)

同时还提供了大量工具类：flex 布局、间距（`mt-20`、`ml-16` 等）、文字截断（`ellipsis`、`ellipsis-2`）、按钮变体（`btn`、`btn-primary`、`btn-outline`、`btn-ghost`、`btn-small`、`btn-disabled`）、标签（`tag`、`tag-red`、`tag-green`、`tag-orange`）、头像尺寸（`avatar-sm` ~ `avatar-xl`）、卡片（`card`）、分割线（`divider`）、空状态（`empty-state`）、徽章（`badge`）、输入框（`input-wrapper`）、列表项（`list-item`）等。

### 自定义 TabBar (`custom-tab-bar/`)

`app.json` 中 `"tabBar.custom": true`，使用自定义 tabBar 组件。四个 tab 页（index、explore、inbox、profile）在 `onShow` 中需要更新 tabBar 选中状态：

```javascript
if (typeof this.getTabBar === 'function' && this.getTabBar()) {
  this.getTabBar().setData({ selected: 0 }) // 0-3
}
```

**发布弹窗**：TabBar 中间的 "+" 按钮触发发布弹窗，提供四种内容类型入口（图文帖子、二手挂单、发布跑腿、发起评分）。弹窗通过 `togglePublishPopup()` 控制，会在打开时修改导航栏背景色以匹配遮罩，关闭时恢复。跳转使用 `safeNavigate`。

**收件箱 Badge**：`loadInboxBadge()` 从 `/api/v1/notification/count` 拉取未读数，并与 globalData 中的乐观更新标记合并后设置到 tabBar 上。非 tab 页面也可以通过 `app.globalData._tabBar.updateBadgeFromGlobalData()` 刷新 badge。

### 自定义导航栏模式

设置了 `"navigationStyle": "custom"` 的页面需要自行处理状态栏和导航栏。标准做法：

1. 在 `onLoad` 中计算状态栏和胶囊按钮高度：
```javascript
const systemInfo = wx.getSystemInfoSync()
const menuButton = wx.getMenuButtonBoundingClientRect()
const statusBarHeight = systemInfo.statusBarHeight
const navBarHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
```

2. WXML 中使用动态布局：
```xml
<view class="status-bar-placeholder" style="height: {{statusBarHeight}}px;"></view>
<view class="nav-bar" style="height: {{navBarHeight}}px;">
  <!-- 返回按钮 + 标题 + 占位 -->
</view>
```

3. 左侧返回按钮统一使用 SVG：`<image src="/images/SVG/返回.svg" mode="aspectFit">`

### 导航辅助 (`utils/safeNavigate.js`)

微信小程序页面栈上限为 10 层。`safeNavigate.js` 在栈深度 ≥ 9 时自动降级 `wx.navigateTo` 为 `wx.redirectTo`，避免超限报错。同时提供 `safeSwitch()` 用于带 loading 的 tab 切换。深层页面跳转建议使用此工具。

### STOMP WebSocket 聊天 (`utils/stomp.js`)

轻量级 STOMP over WebSocket 客户端，用于实时聊天功能（`pages/chat/`）。用法：

```javascript
const client = createStompClient({
  url: 'ws://localhost:5659/ws',
  token: wx.getStorageSync('token'),
  onMessage: (msg) => { ... },
  onConnected: () => { ... },
  onError: (err) => { ... }
})
client.connect()
client.subscribe('/queue/user/123', callback)
client.send('/app/chat/456/send', { receiverId: 456, ... })
client.disconnect()
```

### 幸运抽奖 API (`utils/api/lottery.js`)

封装抽奖/邀请有奖相关 API：
- `getActivities(cursor, size)` — 活动列表（游标分页）
- `getActivityDetail(id)` — 活动详情
- `getMyTickets(activityId)` — 我的抽奖号码

返回数据已做字段映射（如 `coverImage`、`prizes`、`sourceLabel` 等）。

### Mock 数据结构 (`utils/mock.js`)

500+ 行的中央 mock 数据模块，包含：帖子、二手商品、组队活动、评分、跑腿任务、通知、会话列表、聊天消息、学校/专业列表、书单、搜索历史等。添加新功能时，优先在此文件中扩充对应的 mock 数据。

## 页面架构

### Tab 页（4 个）
- `pages/index/` — 首页，四分类切换（帖子/二手/跑腿/评分），推荐/关注流，二手有二级分类（书籍资料/其他），书籍资料有分类标签筛选
- `pages/explore/` — 探索页，发现区（附近/热门/最新）+ 活动列表
- `pages/inbox/` — 收件箱，通知栏（点赞/粉丝/评论/系统消息）+ 互关/临时会话列表
- `pages/profile/` — 个人资料，用户信息卡片 + 我发布的/我收藏的双 tab

### 功能页面
- `pages/search/` — 搜索页（自定义导航 + 搜索历史）
- `pages/search-result/` — 搜索结果（分类 tab 筛选）
- `pages/publish/` — 发布入口（四种类型选择）
- `pages/publish-post/` — 发布帖子/二手（支持 `feed` 和 `secondhand` 两种模式）
- `pages/publish-errand/` — 发布跑腿任务
- `pages/publish-rating/` — 发起评分（教师评分）
- `pages/chat/` — 聊天页面（STOMP WebSocket 实时通信）
- 详情页：`post-detail`、`market-detail`、`team-detail`、`rating-detail`、`errand-detail`
- `pages/order/` — 订单页面
- `pages/recharge/`、`pages/recharge-success/` — 充值
- `pages/complaint/`、`pages/complaint-form/` — 投诉举报
- `pages/user-home/` — 他人主页
- `pages/edit-profile/` — 编辑个人资料
- `pages/edit-post/` — 编辑帖子
- `pages/my-posts/`、`pages/my-market/`、`pages/my-booklist/` — 我的帖子/二手/书单
- `pages/following/`、`pages/followers/`、`pages/liked/` — 关注/粉丝/点赞列表
- `pages/purchased/` — 已购买
- `pages/comments/` — 评论区（独立页面）
- `pages/system-msg/` — 系统消息详情
- `pages/book-preorder/`、`pages/book-preorder-detail/` — 书籍预定
- `pages/invite/`、`pages/invite-detail/` — 邀请有奖/抽奖
- `pages/teacher-ratings/`、`pages/apply-teacher/` — 教师评分/申请教师
- `pages/address/`、`pages/address-form/` — 地址管理
- `pages/filter/` — 筛选页
- `pages/share/` — 分享页
- `pages/school-appeal/` — 学校申诉
- `pages/exit-school/` — 退出学校
- `pages/more-options/` — 更多选项
- `pages/published/` — 已发布内容

### 认证流程
`login` → `wechat-auth` → `complete-info` → 选择学校/专业 → 首页

## SVG 资源 (`images/SVG/`)

核心 SVG 图标：

| 文件 | 用途 |
|---|---|
| `返回.svg`、`返回箭头.svg` | 返回按钮 |
| `搜索.svg` | 搜索图标 |
| `私信.svg`、`chat.svg` | 私信/聊天 |
| `帖子.svg` | 帖子分类 |
| `二手市场.svg` | 二手分类 |
| `评分.svg`、`评分 (2).svg` | 评分分类 |
| `跑腿.svg`、`跑腿 (2).svg` | 跑腿分类 |
| `评论.svg`、`评论笔.svg` | 评论图标 |
| `点赞.svg`、`点赞-已赞.svg` | 点赞/已赞图标 |
| `收藏.svg`、`收藏-已收藏.svg` | 收藏/已收藏图标 |
| `新增.svg` | 新增/加号图标 |
| `主页.svg`、`活动.svg`、`收件箱.svg`、`个人资料.svg` | TabBar 图标 |
| `删除.svg` | 删除图标 |
| `好友.svg`、`微信.svg` | 好友/微信 |
| `图文.svg`、`挂单.svg` | 发布入口图标 |
| `拍照.svg`、`相册.svg` | 图片选择 |
| `系统消息.svg`、`收到点赞.svg`、`新粉丝.svg`、`评论和@.svg` | 通知类型图标 |
| `私密.svg` | 私密内容标记 |
| `匿名用户.svg` | 匿名头像 |

头像是在 `images/avatars/` 下的 53 个 PNG 文件，Sketch 导出的图片在 `images/sketch/` 下。
