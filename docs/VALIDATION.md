# 验证范围

本文是验证状态的唯一权威汇总。证据分四级，互不替代：

1. **自动测试**：纯逻辑、HTTP 边界、状态机；
2. **包与宿主检查**：编译入口、真实宿主加载、模拟目录；
3. **真实联调**：真实 Magpie、真实模型生成；
4. **未验证**：明确列出，不用其他级别推断。

## 1. 当前适配

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-11-24 |
| 插件版本 | v0.1.0 |
| 目标宿主 | OpenCode **2.4.1**（`opencode --version` 实测） |
| 构建/类型 SDK | `@opencode/plugin` **2.4.1** |
| 传递 SDK | `@opencode/ai`、`@opencode/schema`、`@opencode/client`、`@opencode/protocol`、`@opencode/util` 均为 2.4.1 |
| Node.js | 24.22.1 |
| 平台 | Windows |
| 模型生成 | **未执行**（包含模拟生成） |
| 真实 Magpie | **未连接** |

### 1.1 本次执行结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run check` | 通过 |
| 单元测试 | `npm test` | **18/18 通过**（3 个测试文件） |
| 构建与包入口 | `npm run check:package` | 通过，输出 `Built package export loaded` |
| 宿主冒烟 | `npm run test:host` | 通过；真实 OpenCode 2.4.1 加载本地包，显示嵌套模型 ID，**零推理请求** |
| 依赖审计 | `npm audit --json` / `--omit=dev` | 24 moderate、0 high、0 critical；无自动修复 |
| 打包清单 | `npm pack --dry-run` | 通过，包含 `dist`、`src`、`docs`、示例与许可证 |

宿主冒烟使用 localhost 模拟网关与模拟密钥，只验证发现鉴权、URL 前缀、注册表与 `opencode models` 输出；不发送聊天/补全请求。

### 1.2 本次未执行

- `npm run test:host:inference`（模拟 SSE 推理）；
- `node tools/verify-live.mjs`（真实网关 + 一次真实生成，可能产生上游用量）；
- 真实 Linux Magpie 目录对比；
- 真实网络断开/恢复演练；
- 运行中 TUI 增删模型传播计时；
- 所有目录模型的逐个生成；
- 工具、视觉、Responses、reasoning variants、分页目录。

## 2. 兼容矩阵

| 环境 / 范围 | 状态 |
| --- | --- |
| Windows / Node 24.22.1 / OpenCode 2.4.1 | 类型、18 项测试、构建、包入口、宿主模拟通过 |
| SDK 2.4.1 | 已核对 `Plugin.define`、`provider.transform/reload`、带作用域的 `http.request`、`dispose` |
| OpenCode 2.4.0 | 上一轮适配基线；本次未重复运行 |
| OpenCode 2.3.2 | 历史真实联调；不作为 2.4.x 结论 |
| Windows/Linux、Node 22/24/26 CI | 已配置，**尚无远端 Actions 通过记录** |
| 其他宿主/Node 版本 | 未承诺 |

## 3. 自动测试覆盖

当前 18 项测试覆盖：

| 领域 | 覆盖点 |
| --- | --- |
| 目录解析 | `magpie_label` 优先级、控制字符回退、`type=model`、`type=chat`、非 chat 过滤、嵌套 ID、排序、限额、重复 ID、不安全 ID、畸形结构 |
| 签名 | 顺序变化不改变签名 |
| URL | 保留代理前缀、末尾斜杠、拒绝内嵌凭据、拒绝非 HTTP(S) |
| 发现 HTTP | 401/403/500 不泄露响应体、畸形 JSON、超时、拒绝重定向 |
| 注册 | provider 注册、嵌套 `modelID`、冲突检测 |
| 鉴权钩子 | 作用域参数、Bearer 注入、`redirect: "error"`、请求体保持 |
| 轮询 | 启动发现、顺序变化不 reload、错误保留、连续空响应确认、恢复、reload 失败重试、重叠刷新合并、停止后不再刷新 |
| 选项 | 必填校验、URL 校验、空白裁剪、范围收敛、未知键告警 |
| 清理 | 钩子与注册均释放、定时器停止 |

测试中的 HTTP 只访问 `127.0.0.1` 随机端口。

## 4. 历史基线（仅追溯）

| 项目 | 记录 |
| --- | --- |
| 日期 | 2026-11-22 |
| 插件 / 宿主 / SDK | v0.1.0 / 2.3.2 / 2.3.2 |
| 真实网关 | Linux Magpie，`/v1/models` 鉴权 HTTP 200 |
| 目录 | 96 个模型，ID 与 OpenCode 列表一致 |
| 显示名 | 96 个模型名称与 `magpie_label` 一致 |
| 生成 | `trae-cn/Doubao-Seed-2.1-Turbo` 返回 `MAGPIE_SYNC_OK`，退出码 0 |
| 证据文件 | [live-validation.json](live-validation.json) |

该记录证明 2.3.2 历史行为，**不证明** 2.4.1 的推理、插件加载或 API 兼容性。目录数量也不代表当前始终为 96 个。

## 5. 待完成验证

按优先级：

1. **真实 Magpie 目录对比**：在 2.4.1 下比对远端与 `opencode models` 的全部 ID、数量、显示名。
2. **单模型生成**：经授权选择一个测试模型，验证 Bearer 注入、wire model、SSE 流式响应。
3. **运行中增删传播**：保持 TUI 运行，在 Magpie 增删模型，记录 `Catalog synced` 到 `/models` 变化的时间。
4. **断网恢复**：至少两个刷新周期不可达，确认目录保留；恢复后确认下一周期同步。
5. **空目录语义**：验证一次空响应保留、连续两次清空、无效 JSON 打断计数。
6. **限额为 0**：确认宿主输出/压缩行为，决定是否需要默认限额策略。
7. **协议与能力**：工具调用、视觉、Responses、reasoning variants、多页目录。

## 6. 手工复验步骤

### 6.1 无生成复验

```powershell
opencode --version        # 期望 2.4.1
npm run check
npm test
npm run check:package
npm run test:host
opencode models
```

通过条件：

- 所有命令退出码为 0；
- `npm test` 为 18/18；
- 宿主冒烟输出 `zero inference requests`；
- `opencode models` 出现预期 `magpie/*`。

### 6.2 真实联调（需单独授权）

```powershell
node tools/verify-live.mjs
# 或指定目录中的模型 ID
node tools/verify-live.mjs <group>/<model>
```

注意：

- 该工具读取 `%USERPROFILE%/.config/opencode/opencode.json` 中本插件的 `gatewayKey`；
- 会比对全部模型 ID，并发送**一次真实生成请求**；
- 可能产生上游用量；
- 结果写入 `docs/live-validation.json`，密钥会脱敏；
- 不覆盖仅环境变量凭据、自定义配置目录或全部模型。

## 7. 证据边界

- 自动测试通过不等于宿主运行时兼容；宿主冒烟通过不等于真实模型可用。
- 一次生成成功不等于所有模型、协议、工具或限额行为正确。
- `Catalog synced` 只证明服务端注册表提交，不证明 TUI 已刷新。
- 依赖审计为快照；漏洞库更新后应重新执行。
- 当前没有安全认证、SLA 或“所有模型可用”的承诺。

依赖详情见 [依赖审查](DEPENDENCY-REVIEW.md)；宿主/SDK 升级流程见 [兼容性策略](COMPATIBILITY.md)。

## 2026-11-25 工程规范对齐验证

环境：Windows、Node.js 24.22.1、OpenCode 2.4.1。未执行模型生成（包括模拟生成）、真实远端发现、真实凭据或人工终端交互验收。

- `npm run verify` 通过：类型、18/18 测试、构建及包入口检查。
- `npm run test:host` 通过：真实宿主加载仓库 dist，localhost 模拟目录鉴权与嵌套模型 ID 验证通过，零推理。
- `npm pack --offline --pack-destination .host` 生成 v0.1.0 制品。
- `npm install --prefix .host/package-install --ignore-scripts --no-audit --no-fund ./.host/opencode-magpie-sync-0.1.0.tgz` 隔离安装通过；安装入口导入确认 `magpie.sync` 和 setup。
- 本机派生 runner `node .host/installed-host-smoke.mjs` 将宿主测试入口改为安装后的包，使用独立 `.host/installed-smoke`；真实 OpenCode 加载 tarball 安装结果，目录鉴权、嵌套 ID 与零推理断言通过。该 runner 仅为本轮验证产物；仓库维护的通用工具仍为 `tools/host-smoke.mjs`。
- 初次 localhost 连接因沙箱 EACCES 失败，自动审批后复验通过。离线安装因缓存缺少传递依赖报 ENOTCACHED；从包注册表补齐依赖后通过，未访问真实网关。

制品、本机 runner 和日志位于被忽略的 `.host/`，不作为仓库提交内容。公共规范见 [统一工程规范](ENGINEERING.md)。
