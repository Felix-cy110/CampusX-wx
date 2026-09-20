# 小程序简版 CI/CD

工作流：`.github/workflows/ci-cd.yml`。

## 自动检查

提交 PR 或推送到 `main` / `master`，自动使用 Node.js 22 检查 JavaScript 语法并执行现有 `tests/*.test.js`。常规 CI 无需 npm 依赖和微信密钥。

本地运行：`node --test "tests/*.test.js"`。这些测试模拟微信 API，不能代替微信开发者工具编译和真机验收。

## 手动上传开发版本

1. 在仓库 **Settings → Secrets and variables → Actions → Variables** 配置 `WECHAT_APP_ID`，填入要发布的小程序 AppID。本地项目配置和 README 中的 AppID 不一致，应以微信公众平台为准。
2. 在 **Secrets** 配置 `WECHAT_PRIVATE_KEY`，内容为微信公众平台下载的完整代码上传私钥。
3. 按微信公众平台的代码上传设置配置执行环境的出口 IP。当前使用 GitHub 托管 runner，出口 IP 不固定；若已启用严格白名单，需要将上传任务改为具备固定出口 IP 的执行环境后再使用，或由管理员按平台规则调整 IP 限制。
4. 合并工作流到仓库默认分支后，打开 **Actions → 小程序 CI/CD → Run workflow**，选择默认分支，勾选 `upload`。

检查通过后，安装固定版本 `miniprogram-ci@2.1.31`，从 `.github/project.ci.json` 生成临时项目配置，上传开发版本。版本号为 `1.运行序号.重试次数`，描述包含提交号。私钥存于 runner 临时目录，不进入小程序代码包；上传结束后清理临时私钥与配置。

上传成功后，在微信公众平台设置体验版、提审和发布。上传不会自动提审或上线，也不会修改现有后端地址；当前体验版仍连接现有公网后端。

本地的 `project.config.json`、`project.private.config.json` 继续保持忽略，上传脚本拒绝覆盖已有个人配置。编译选项后续变化时，同步更新 `.github/project.ci.json`。

工具依据：[微信官方 miniprogram-ci](https://www.npmjs.com/package/miniprogram-ci)。
