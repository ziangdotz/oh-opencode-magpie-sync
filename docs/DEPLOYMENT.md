# 部署与验收手册

本文面向受控环境的生产部署，覆盖交付物、前置条件、上线、无生成验收、回滚与支持边界。日常运维见 [运行规范](OPERATIONS.md)。

## 1. 交付目标

| 项目 | 基线 |
| --- | --- |
| 插件 | `opencode-magpie-sync` v0.1.0（private） |
| 宿主 | OpenCode 2.4.2 |
| SDK | `@opencode/plugin` 2.4.2（精确锁定） |
| Node.js | 构建/测试 24.22.1；引擎范围见 `package.json` |
| 形态 | 仅服务端插件；无 TUI 入口 |
| 许可证 | MIT |

交付物包括：可审计源码、`package-lock.json`、编译入口 `dist/index.js`、配置示例与本目录下的运行文档。

适用场景：受控网络中的 Magpie 文本模型目录接入。以下能力**不在**当前交付范围：

- 工具调用、视觉、多协议路由、reasoning variants；
- 多页目录、多个 Magpie 网关、TUI 内独立刷新入口；
- 跨重启目录缓存、SLA 或所有模型可用性承诺。

商业部署方需自行确认 Magpie、上游模型服务与传递依赖的授权和服务条款。MIT 许可证允许商业使用，但不构成对第三方服务的授权。

## 2. 部署前置条件

| 项目 | 要求 | 验证方式 |
| --- | --- | --- |
| 宿主版本 | 2.4.2 | `opencode --version` |
| 网络 | 服务进程可访问网关 host:port | 在服务账号下测试 TCP/HTTP |
| 凭据 | 可读取目录并使用目标模型的 Gateway Key | 由网关管理员确认 |
| 包目录 | 持久绝对路径，不指向临时解压目录 | 检查 `package.json` 与 `dist/index.js` |
| 配置 | 与现有 `plugins` 合并，只有一个 magpie 来源 | 审阅 `opencode.json` |
| 构建 | `npm ci`、检查、测试、包入口通过 | 见第 3 节 |
| 备份 | 当前配置与旧包可恢复 | 备份保存在受控目录 |

> 配置与备份可能包含明文 Gateway Key。禁止上传到工单、Git 仓库或共享盘。

## 3. 构建与制品

在候选包目录执行：

```powershell
npm ci
npm run verify
npm pack --dry-run
```

`npm run verify` 依次执行：

1. `npm run check`：TypeScript 严格检查；
2. `npm test`：Vitest 单元测试；
3. `npm run check:package`：构建并验证 Node 可加载包入口。

`npm pack --dry-run` 用于核对发布清单（`dist`、`src`、`docs`、示例、README、许可证等）。需要归档制品时：

```powershell
npm pack
Get-FileHash -LiteralPath ./opencode-magpie-sync-0.1.0.tgz -Algorithm SHA256
```

记录 SHA-256 与构建时间。`prepack` 只自动执行 build，不自动执行完整测试；构建门禁以 `npm run verify` 为准。

## 4. 配置

1. 用 `opencode debug paths` 确认服务端配置目录。
2. 在 `opencode.json` 的 `plugins` 数组中添加：

```json
{
  "package": "file:///C:/plugins/opencode-magpie-sync",
  "options": {
    "baseURL": "http://192.0.2.10:3425/v1",
    "gatewayKey": "REPLACE_WITH_MAGPIE_GATEWAY_KEY",
    "refreshSeconds": 30,
    "timeoutMs": 5000
  }
}
```

3. 替换为实际包绝对路径、网关地址与密钥。
4. 后台服务建议使用服务管理器注入 `MAGPIE_GATEWAY_KEY`，避免明文 JSON；使用 JSON 时限制文件权限。
5. 确认没有其他插件或手工配置注册 `magpie`。

完整字段与 URL 规则见 [配置参考](CONFIGURATION.md)。

## 5. 上线步骤

| 步骤 | 操作 | 通过条件 |
| --- | --- | --- |
| 1 | 备份当前配置、旧包目录/制品与锁文件 | 可恢复到已知可用状态 |
| 2 | 在候选目录完成第 3 节构建 | 全部命令成功 |
| 3 | 更新配置指向候选包，写入 baseURL 与凭据 | 配置可被 JSON 解析 |
| 4 | 在维护窗口重启服务 | `opencode service status` 正常 |
| 5 | 执行第 6 节验收 | 全部必选项通过 |
| 6 | 记录版本、时间、执行人、脱敏结果 | 变更记录完整 |

重启命令：

```powershell
opencode service restart
opencode service status
```

`--standalone` 模式需退出并重启该进程。源码或 `dist` 更新不会热替换运行中的实例。

## 6. 无生成验收

默认验收**不发送聊天或模型生成请求**。

| 检查项 | 操作 | 通过条件 |
| --- | --- | --- |
| 类型与单元 | `npm run check`、`npm test` | 全部通过；HTTP 测试仅访问 localhost |
| 包入口 | `npm run check:package` | 输出 `Built package export loaded` |
| 宿主集成 | `npm run test:host` | 真实宿主加载本地包、显示嵌套 ID、报告零推理请求 |
| 实际目录 | `opencode models` | 出现 `magpie/*` 条目 |
| 名称与 ID | 抽查若干模型 | 显示名符合 `magpie_label`，wire ID 未被改写 |
| 服务状态 | `opencode service status` | 运行正常，无崩溃循环 |
| 日志 | 查看服务日志 | 出现 `Catalog synced: N models`，无密钥泄露 |

示例：

```powershell
npm run check
npm test
npm run check:package
npm run test:host
opencode models
```

可选：在 TUI 中打开 `/models`，确认 **Magpie Gateway** 分组与模型名称。

### 6.1 明确不执行的检查

- `npm run test:host:inference`：会发送模拟推理请求；
- `node tools/verify-live.mjs`：会连接真实网关并发送一次真实生成请求，可能产生上游用量；
- 任意聊天、补全、工具调用或图片请求。

这些检查由部署方按实际网关与授权单独安排。

## 7. 运行指标与故障恢复

| 指标 | 正常表现 | 异常处置 |
| --- | --- | --- |
| 首次发现 | 启动后数秒内出现 `Catalog synced` | 检查网络、密钥、URL 前缀 |
| 周期刷新 | 每个周期尝试一次；无变化不 reload | 频繁 reload 时检查目录是否持续变化 |
| 失败保留 | 断网时目录仍可浏览 | 恢复网络后等待下一周期 |
| 空目录 | 连续两次有效空响应才清空 | 单次空响应不应导致目录消失 |
| 内存 | 目录仅驻留内存 | 重启后需重新发现，属预期 |

发现请求默认超时 5 秒、上限 8 MiB。目录变化提交后，TUI 可见时间还取决于宿主缓存传播，不承诺固定端到端延迟。

## 8. 回滚

触发条件：插件无法加载、目录异常、宿主不稳定、鉴权行为不符合预期。

1. 停止或重启服务前，保存脱敏日志与当前版本信息。
2. 恢复旧包路径/旧制品与匹配的 `package-lock.json`。
3. 执行 `npm ci` 与 `npm run check:package`（若使用源码目录）。
4. 更新配置并重启服务。
5. 用 `opencode models` 确认旧目录恢复。
6. 记录回滚原因、时间与结果。

禁止通过删除 OpenCode 数据库、其他 provider 凭据或用户配置来排障。

## 9. 支持与升级

- 升级宿主或 SDK 前阅读 [兼容性策略](COMPATIBILITY.md)，视为一次受控变更。
- SDK 安全补丁也需经过候选环境验证，不应直接覆盖生产。
- 报告问题时提供：插件/宿主/Node 版本、操作步骤、脱敏错误、Base URL 路径结构、模型 ID、发生时间。
- **不要**提供：Gateway Key、服务密码、完整用户配置、数据库、完整响应体。

证据与未覆盖范围以 [验证范围](VALIDATION.md) 为准；依赖风险以 [依赖审查](DEPENDENCY-REVIEW.md) 为准。
