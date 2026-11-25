# 开发指南

共同分层、开发流程、文档职责与验证授权见 [统一工程规范](ENGINEERING.md)。项目专属规则见本文。

本文面向修改插件本身的开发者。运行与部署见 [运行规范](OPERATIONS.md) 与 [部署与验收](DEPLOYMENT.md)。

## 1. 工具链

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | `^22.12.0 || ^24.0.0 || >=26` | 推荐 24.22.1（实测） |
| TypeScript | 5.9.3 | `strict: true`，`noEmit` 检查 |
| Vitest | 5.1.1 | 单元测试 |
| `@opencode/plugin` | 2.4.1 | 类型与构建依赖，精确锁定 |

安装：

```powershell
npm ci
```

## 2. 命令

| 命令 | 作用 | 是否联网/调用模型 |
| --- | --- | --- |
| `npm run check` | TypeScript 严格检查 | 否 |
| `npm test` | Vitest 单元测试 | 仅 localhost HTTP 测试 |
| `npm run build` | 编译到 `dist/` | 否 |
| `npm run check:package` | 构建 + Node 加载包入口 | 否 |
| `npm run verify` | check → test → check:package | 仅 localhost |
| `npm run test:host` | 真实宿主 + localhost 模拟目录 | 否（零推理） |
| `npm run test:host:inference` | 增加模拟 SSE 推理 | 模拟推理，非真实模型 |
| `node tools/verify-live.mjs` | 真实 Magpie 联调 + 一次生成 | **是**，会产生上游用量 |

默认开发与验收**不执行**最后两项。模拟 SSE 同样属于模型调用测试，必须先取得用户明确授权；真实联调也需单独明确授权。

## 3. 目录结构

```text
src/
  index.ts                 仅导出 default plugin
  core/
    catalog.ts             解析、清洗、去重、排序、签名
    gateway.ts             URL 校验、有界发现请求
  server/
    plugin.ts              选项、注册、鉴权钩子、轮询、卸载
tests/
  catalog.test.ts          纯解析与 URL 规则
  gateway.test.ts          HTTP 错误、超时、重定向
  plugin.test.ts           注册、鉴权、轮询、保留、清理、选项
tools/
  check-package.mjs        包入口加载检查
  host-smoke.mjs           真实宿主 + 模拟目录
  verify-live.mjs          可选真实联调
docs/                      运维与开发文档
```

`core` 不得导入 `@opencode/plugin`，以保持纯 Node 可测。`server` 只使用公开 SDK API，见 [兼容性策略](COMPATIBILITY.md)。

## 4. 核心不变量

修改代码时必须保持：

1. **URL 边界**：发现只请求 `<baseURL>/models`；推理只允许配置的 origin + 路径前缀。
2. **凭据隔离**：密钥不进入 provider/model 元数据、错误消息或日志。
3. **快照原子性**：先构造新数组，`reload()` 成功后才提交签名；失败恢复旧数组。
4. **顺序无关**：排序后签名；仅顺序变化不触发 reload。
5. **空目录防抖**：错误不推进 `emptyCount`；连续两次有效空响应才清空。
6. **有界发现**：超时、8 MiB、拒绝重定向。
7. **清理完整**：停止定时器、等待进行中请求、释放钩子与注册；单步失败不阻断另一步。
8. **稳定标识**：插件 ID、provider ID、模型 wire ID 与包入口不得随意变更。

## 5. 测试分层

| 层级 | 命令 | 证明什么 | 不证明什么 |
| --- | --- | --- | --- |
| 单元 | `npm test` | 解析、边界、轮询状态机、鉴权钩子、清理逻辑 | 宿主真实加载、TUI 传播 |
| 包入口 | `npm run check:package` | 编译产物可被 Node 加载 | 宿主 SDK 运行时兼容 |
| 宿主冒烟 | `npm run test:host` | 真实宿主可加载本地包、发现鉴权、嵌套 ID | 真实模型生成 |
| 模拟推理 | `npm run test:host:inference` | 宿主可完成模拟 SSE 推理、wire model 未改写 | 真实网关能力 |
| 真实联调 | `tools/verify-live.mjs` | 特定网关、特定模型的一次真实调用 | 全模型、全协议、长期稳定性 |

任何层级通过都不能替代另一层级。CI 已配置不等于远端 Actions 已通过。

### 5.1 宿主冒烟细节

`tools/host-smoke.mjs`：

- 在 `.host/smoke` 下创建独立配置与 XDG 目录；
- 启动 localhost 模拟网关，校验 `Bearer mock-only-key`；
- 用真实 `opencode models --standalone` 加载本地包；
- 默认模式若出现任何推理请求会失败；
- 30 秒超时，Windows 下结束子进程树；
- 输出追加到 `.host/smoke/result.txt`。

指定宿主可执行文件：

```powershell
$env:OPENCODE_BIN = 'C:/path/to/opencode.exe'
npm run test:host
```

`.host/`、`dist/`、`node_modules/`、`*.tgz` 均被 `.gitignore` 忽略。

### 5.2 本地 HTTP 测试

单元测试会监听 `127.0.0.1` 随机端口。受限沙箱或安全软件可能阻止本地监听；网络错误不能被当作功能通过，也不能跳过测试后声称通过。

## 6. 调试

### 6.1 观察日志

宿主日志通常位于其数据目录的 `log/opencode.log`。关注：

- `[magpie.sync] Catalog synced: N models`
- `[magpie.sync] Initial discovery unavailable`
- `[magpie.sync] Refresh failed; keeping last catalog`
- `[magpie.sync] Ignoring unknown option`
- `[magpie.sync] Cleanup step failed`

日志不输出密钥、请求头或响应体。

### 6.2 受控验证发现端点

需要确认网关本身是否正常时，可在本机用占位符方式测试。避免把真实密钥写入命令历史；优先使用环境变量：

```powershell
$headers = @{ Authorization = "Bearer $env:MAGPIE_GATEWAY_KEY" }
Invoke-WebRequest -Uri 'http://192.0.2.10:3425/v1/models' -Headers $headers -UseBasicParsing |
  Select-Object StatusCode, @{n='Bytes';e={$_.RawContentLength}}
```

不要打印完整响应体；只检查状态码、大小与是否包含预期模型 ID。

### 6.3 常见开发错误

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 宿主仍加载旧行为 | 未重新 build 或未重启 | `npm run build` 后重启 |
| `Magpie provider collision` | 重复插件/手工 provider | 只保留一个来源 |
| 测试全部超时 | 本地 HTTP 被拦截 | 放行 localhost 或换环境，不要跳过 |
| 类型错误来自 SDK | 宿主升级导致契约变化 | 阅读新 `.d.ts`，按兼容性流程适配 |
| 包入口加载失败 | `dist` 缺失或 exports 错误 | `npm run check:package` |

## 7. 修改指引

### 7.1 新增 Magpie 字段映射

1. 在 `core/catalog.ts` 的 `MagpieModel` 与 `parseCatalog` 中增加受信任字段；
2. 在 `server/plugin.ts:toModel` 中映射到 `Model.Info`；
3. 确保字段进入签名（`catalogSignature` 序列化整个结构）；
4. 增加解析、非法值、签名变化测试；
5. 更新 [配置参考](CONFIGURATION.md) 与 [验证范围](VALIDATION.md)。

### 7.2 修改选项

1. 在 `KNOWN_OPTIONS` 与 `readOptions` 中增加校验；
2. 保持未知键告警而非静默；
3. 增加边界测试（类型错误、越界、空白）；
4. 更新配置文档与示例。

### 7.3 修改刷新逻辑

必须维持：单飞（single-flight）、停止后不提交、reload 失败回滚、空目录计数语义。相应测试位于 `tests/plugin.test.ts`，不要只改实现不改测试。

## 8. 代码约束

- 不引入 `any`、`@ts-ignore` 或放宽 `strict` 来消除 SDK 类型错误。
- 不把密钥、完整响应体或请求头写入日志/错误。
- 不新增未声明的网络访问；发现与推理都必须受配置约束。
- 不改变 `core` 的无宿主依赖属性。
- 可观察行为变化必须同步测试、配置文档、CHANGELOG。
- 版本号变更需维护者明确决定；当前严格固定为 v0.1.0。

## 9. 依赖更新

```powershell
npm install --save-exact @opencode/plugin@<version>
npm run verify
npm run test:host
npm audit --json
```

- 不使用 `npm audit fix --force` 覆盖 SDK 传递依赖；
- 记录审计变化与兼容性结论；
- 依赖更新后重新验证宿主加载，不仅看类型检查。

## 10. 提交前检查

```powershell
npm run verify
npm run test:host
git status --short
```

确认：

- 没有提交 `node_modules/`、`dist/`、`.host/`、`.tgz`、日志或密钥；
- 文档中的版本、命令、测试数量与代码一致；
- 新增行为有测试覆盖；
- 未把历史 2.3.2 证据写成 2.4.1 结论。
