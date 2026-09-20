const fs = require('node:fs')
const path = require('node:path')

async function upload() {
  const { WECHAT_APP_ID, WECHAT_PRIVATE_KEY, RUNNER_TEMP, GITHUB_SHA, GITHUB_RUN_NUMBER, GITHUB_RUN_ATTEMPT } = process.env
  if (!/^wx[0-9a-f]{16}$/.test(WECHAT_APP_ID || '')) {
    throw new Error('请在仓库 Variables 中配置正确的 WECHAT_APP_ID')
  }
  if (!WECHAT_PRIVATE_KEY || !RUNNER_TEMP || !GITHUB_SHA || !GITHUB_RUN_NUMBER || !GITHUB_RUN_ATTEMPT) {
    throw new Error('缺少微信上传私钥或 GitHub Actions 运行环境')
  }

  const projectPath = path.resolve(__dirname, '../..')
  const configPath = path.join(projectPath, 'project.config.json')
  // 本地个人配置不属于 CI 输入，避免在本地运行时覆盖它。
  if (fs.existsSync(configPath)) {
    throw new Error('上传脚本需要干净检出，不能覆盖已有 project.config.json')
  }
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.ci.json'), 'utf8'))
  config.appid = WECHAT_APP_ID
  const keyDir = fs.mkdtempSync(path.join(RUNNER_TEMP, 'campusx-wechat-'))
  const keyPath = path.join(keyDir, 'upload.key')
  let configCreated = false

  try {
    fs.writeFileSync(keyPath, WECHAT_PRIVATE_KEY, { mode: 0o600, flag: 'wx' })
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { flag: 'wx' })
    configCreated = true
    const ci = require('miniprogram-ci')
    const project = new ci.Project({
      appid: WECHAT_APP_ID,
      type: 'miniProgram',
      projectPath,
      privateKeyPath: keyPath,
      ignores: ['.git/**/*', '.github/**/*', 'tests/**/*', 'docs/**/*', 'node_modules/**/*', '**/*.md', 'package*.json', 'project.private.config.json'],
    })
    const version = `1.${GITHUB_RUN_NUMBER}.${GITHUB_RUN_ATTEMPT}`
    await ci.upload({
      project,
      version,
      desc: `CampusX ${GITHUB_SHA.slice(0, 12)}`,
      setting: { useProjectConfig: true },
      robot: 1,
    })
    console.log(`开发版本 ${version} 上传成功，请到微信公众平台设置体验版或提交审核。`)
  } finally {
    fs.rmSync(keyPath, { force: true })
    fs.rmdirSync(keyDir)
    if (configCreated) fs.rmSync(configPath, { force: true })
  }
}

upload().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
