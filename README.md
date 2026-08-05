# CampusX - 校园社交微信小程序

CampusX 是一个功能丰富的校园社交微信小程序，支持图文帖子发布、二手交易、跑腿服务、教师评分、实时聊天、幸运抽奖等多种校园场景。

## 技术栈

- **前端框架**：微信小程序原生框架（WXML + WXSS + JS）
- **基础库版本**：3.15.2
- **后端**：Spring Boot（端口 5659，API 前缀 `/api/v1`，**后端代码不在本仓库**）
- **实时通信**：STOMP over WebSocket
- **开发工具**：微信开发者工具

## 功能模块

### 内容发布
- **图文帖子** — 支持本地/跨校发布，图片上传，标签与分类
- **二手挂单** — 书籍资料 / 其他商品分类，支持预订与购买
- **跑腿任务** — 发布、抢单、状态追踪
- **教师评分** — 发起评分、查看教师评分列表

### 社交互动
- **点赞** — 帖子、评论点赞
- **收藏** — 内容收藏管理
- **评论** — 独立评论区，支持回复与点赞
- **关注** — 用户关注/粉丝体系
- **实时聊天** — 基于 WebSocket STOMP 协议的私信功能

### 探索与发现
- **首页** — 帖子/二手/跑腿/评分四分类切换，推荐流与关注流
- **探索页** — 附近/热门/最新内容发现
- **搜索** — 全局搜索，分类筛选，搜索历史

### 活动与运营
- **幸运抽奖** — 参与抽奖活动，查看中奖号码
- **邀请有奖** — 邀请机制与奖励
- **书籍预定** — 教材/书籍预购

### 用户系统
- **微信登录** — 微信授权 → 完善信息 → 选择学校/专业
- **个人资料** — 编辑资料、我的帖子/二手/书单、已购买
- **收件箱** — 通知分类（点赞/粉丝/评论/系统消息），未读 badge
- **投诉举报** — 内容投诉与反馈
- **地址管理** — 收货地址增删改

## 项目结构

```
CampusX-wx/
├── app.js                  # 应用入口，全局状态管理（globalData）
├── app.json                # 应用配置（页面路由、TabBar、网络超时）
├── app.wxss                # 全局样式与设计系统（CSS 自定义属性）
├── project.config.json     # 微信开发者工具项目配置
├── custom-tab-bar/         # 自定义 TabBar 组件（含发布弹窗）
├── pages/                  # 页面目录
│   ├── index/              # 首页（四分类内容流）
│   ├── explore/            # 探索页
│   ├── inbox/              # 收件箱（通知 + 会话列表）
│   ├── profile/            # 个人资料
│   ├── login/              # 登录
│   ├── wechat-auth/        # 微信授权
│   ├── complete-info/      # 完善信息
│   ├── select-school/      # 选择学校
│   ├── select-major/       # 选择专业
│   ├── post-detail/        # 帖子详情
│   ├── market-detail/      # 二手商品详情
│   ├── team-detail/        # 组队详情
│   ├── rating-detail/      # 评分详情
│   ├── errand-detail/      # 跑腿详情
│   ├── publish/            # 发布入口
│   ├── publish-post/       # 发布帖子/二手
│   ├── publish-errand/     # 发布跑腿
│   ├── publish-rating/     # 发起评分
│   ├── chat/               # 聊天（WebSocket）
│   ├── search/             # 搜索
│   ├── search-result/      # 搜索结果
│   ├── comments/           # 评论区
│   ├── user-home/          # 他人主页
│   ├── edit-profile/       # 编辑资料
│   ├── edit-post/          # 编辑帖子
│   ├── my-posts/           # 我的帖子
│   ├── my-market/          # 我的二手
│   ├── my-booklist/        # 我的书单
│   ├── following/          # 关注列表
│   ├── followers/          # 粉丝列表
│   ├── liked/              # 点赞列表
│   ├── purchased/          # 已购买
│   ├── order/              # 订单
│   ├── recharge/           # 充值
│   ├── complaint/          # 投诉举报
│   ├── complaint-form/     # 投诉表单
│   ├── address/            # 地址管理
│   ├── address-form/       # 地址表单
│   ├── filter/             # 筛选
│   ├── share/              # 分享
│   ├── invite/             # 邀请有奖
│   ├── invite-detail/      # 邀请详情
│   ├── book-preorder/      # 书籍预定
│   ├── book-preorder-detail/# 书籍预定详情
│   ├── teacher-ratings/    # 教师评分列表
│   ├── apply-teacher/      # 申请教师
│   ├── school-appeal/      # 学校申诉
│   ├── exit-school/        # 退出学校
│   ├── system-msg/         # 系统消息详情
│   ├── published/          # 已发布内容
│   └── more-options/       # 更多选项
├── utils/                  # 工具模块
│   ├── config.js           # 全局配置（BASE_URL）
│   ├── request.js          # 网络请求封装（自动 token 注入）
│   ├── mock.js             # Mock 数据（500+ 行，含各类模拟数据）
│   ├── stomp.js            # STOMP WebSocket 客户端
│   ├── safeNavigate.js     # 页面栈溢出保护（10 层限制）
│   └── api/
│       └── lottery.js      # 抽奖 API 封装
└── images/
    ├── SVG/                # SVG 图标资源（40+ 个）
    ├── avatars/            # 头像图片（53 个 PNG）
    └── sketch/             # Sketch 导出图片
```

## 快速开始

### 环境要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）
- 后端服务运行在 `http://localhost:5659`（Spring Boot 项目，需单独启动）

### 启动步骤

1. **克隆仓库**
   ```bash
   git clone <repo-url>
   ```

2. **配置后端地址**
   
   编辑 `utils/config.js`，修改 `BASE_URL` 为你的后端地址：
   ```js
   const BASE_URL = 'http://localhost:5659'
   ```

3. **打开微信开发者工具**
   
   导入项目根目录，AppID 使用 `wxc798a954e7b425d7`（或替换为你的测试 AppID）。

4. **配置开发环境**
   
   确保 `project.private.config.json` 中：
   ```json
   {
     "setting": {
       "urlCheck": false
     }
   }
   ```

5. **开始开发**
   
   修改 `.js`/`.wxml`/`.wxss`/`.json` 文件后，开发者工具自动编译并热重载。

### 认证流程

`登录页` → `微信授权` → `完善个人信息` → `选择学校` → `选择专业` → `进入首页`

## 后端 API 对接状态

| 功能模块 | API 路径 | 状态 |
|---------|---------|------|
| 图文帖子发布 | `/api/post/publish/*` | ✅ 已对接 |
| 二手挂单发布 | `/api/v1/idle/product/*` | ✅ 已对接 |
| 图片上传 | `/api/v1/upload/image` | ✅ 已对接 |
| 跑腿服务 | `/api/v1/errand/*` | ✅ 已对接 |
| 幸运抽奖/邀请有奖 | `/api/v1/lottery/*` | ✅ 已对接 |
| 帖子点赞 | `/api/v1/post/*/like` | ✅ 已对接 |
| 通知未读数 | `/api/v1/notification/count` | ✅ 已对接 |
| 实时聊天 | `/ws`（WebSocket STOMP） | ✅ 已对接 |
| 首页内容列表 | — | ⚠️ 部分对接（混合 mock） |
| 详情页（商品/组队/评分） | — | ⚠️ 部分对接（混合 mock） |
| 搜索 | — | ⚠️ 使用 mock |
| 通知内容列表 | — | ⚠️ 使用 mock |

## 设计系统

项目在 `app.wxss` 中定义了完整的设计系统，所有页面通过 CSS 自定义属性引用：

- **主色**：`--color-primary: #255AC5`
- **语义色**：红色、绿色、橙色、紫色、金色
- **字号**：`--font-xs`(20rpx) ~ `--font-3xl`(48rpx)，含 `--font-title`(72rpx)、`--font-giant`(96rpx)
- **圆角**：`--radius-sm`(8rpx)、`--radius-md`(16rpx)、`--radius-lg`(24rpx)

同时提供丰富的工具类：Flex 布局、间距、文字截断、按钮变体、标签、头像、卡片、分割线、空状态、徽章、输入框、列表项等。

## 关键设计说明

### 自定义导航栏
部分页面设置 `navigationStyle: custom`，需自行处理状态栏高度和胶囊按钮避让。左侧返回按钮统一使用 `/images/SVG/返回.svg`。

### 页面栈保护
微信小程序页面栈上限 10 层。`utils/safeNavigate.js` 在栈深度 ≥ 9 时自动降级 `navigateTo` 为 `redirectTo`，深层页面跳转建议使用此工具。

### 自定义 TabBar
项目使用自定义 TabBar（`custom-tab-bar/`），中间 "+" 按钮触发发布弹窗。四个 Tab 页在 `onShow` 中需调用 `this.getTabBar().setData({ selected: N })` 更新选中状态。

### 图片路径转换
后端返回的相对路径（如 `/images/xxx.png`）必须通过 `utils/request.js` 的 `toFullUrl()` 函数转换为完整 URL 后才能正常显示。

## 开发注意事项

- 无 npm 依赖，无需构建步骤
- 修改非配置文件后请编译检查是否有错误
- 全局网络超时 60 秒
- 添加新功能时优先在 `utils/mock.js` 中扩充对应 mock 数据
- 页面间传递数据使用 `wx.setStorageSync` / `wx.getStorageSync`
- 登录 token 存储在 `wx.getStorageSync('token')`

## License

（待补充）
