# 验证范围

本文区分当前适配、历史证据和未执行项。插件版本保持 v0.1.0，无配置迁移。

## 当前适配：2026-11-26

Windows / Node.js 24.22.1 / OpenCode 2.4.2 / 精确 SDK `@opencode/plugin` 2.4.2。只使用 localhost 模拟目录、测试密钥和独立 config/data/cache/state 目录，未修改日常配置。

| 检查 | 结果 |
| --- | --- |
| `npm run verify` | 通过：严格类型、18/18 单元测试、构建及包入口加载 |
| `npm pack --offline --pack-destination .host` | 生成 v0.1.0 tarball |

初次沙箱执行有 1 项 localhost 发现测试失败（17/18）；网络权限下复验全部通过。初次沙箱在线安装报 ENOTFOUND；离线安装因沙箱 npm 缓存缺失报 ENOTCACHED；后续安装结果如下。

## 无模型宿主与安装验证

`npm run test:host` 通过：真实 OpenCode 2.4.2 加载仓库包，目录鉴权与嵌套 ID 断言通过，零推理请求。

`npm install --prefix .host/package-install-242 --ignore-scripts --no-audit --no-fund ./.host/opencode-magpie-sync-0.1.0.tgz` 安装通过（272 packages）；再指定安装目录运行同一 smoke 工具通过，零推理请求。安装有传递依赖弃用提示，未自动修复。

完整 `npm audit --json`：24 moderate、0 high、0 critical；无自动修复。生产专用审计本轮未单独重复。SDK 传递模块均 2.4.2，Effect 为 4.1.0。通用工具 `tools/host-smoke.mjs` 支持 `OPENCODE_TEST_PACKAGE`（默认仓库目录）和 `OPENCODE_TEST_ROOT`（默认 `.host/smoke`）。清除继承的 OpenCode/Magpie/XDG 覆盖项，并重新设置隔离目录和模拟密钥。只调用 `opencode models --standalone`；若收到推理请求即失败。

## 未执行项

- 所有模型生成，包括 localhost 模拟 SSE；未运行 `test:host:inference` 或 `verify-live.mjs`。
- 真实 Magpie 发现、真实凭据、真实网络恢复与目录对比。
- 人工 TUI `/models` 选择及运行中增删传播；CLI 列表验证不能替代终端交互。
- 工具、视觉、Responses、reasoning variants、分页与未知限额的生成行为。
- 远端 CI 与其他平台/Node 版本。

## 历史证据（不代表当前版本）

- 2026-11-24/25，OpenCode/SDK 2.4.1：18 项单元、包入口、localhost 无生成宿主检查及 tarball 安装检查通过；当时审计为 24 moderate。
- 2026-11-22，OpenCode/SDK 2.3.2：曾对 Linux Magpie 做 96 模型目录与一次生成检查，见 [历史记录](live-validation.json)。本轮未重复，不能推断 2.4.2 的真实推理可用性。

## 复验

```powershell
npm run verify
npm run test:host
# tarball 安装到隔离目录后，可复用同一工具
$env:OPENCODE_TEST_PACKAGE = '.host/package-install-242/node_modules/opencode-magpie-sync'
$env:OPENCODE_TEST_ROOT = '.host/installed-smoke-242'
node tools/host-smoke.mjs
```

使用前确认 `OPENCODE_BIN` 指向目标宿主、Node 满足 package.json 引擎。工具不读取日常配置或真实凭据；证据目录被 Git 忽略。生产配置下启动插件会自动访问配置网关，属于真实目录检查，需另行授权。
