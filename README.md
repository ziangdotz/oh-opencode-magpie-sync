# opencode-magpie-sync

**OpenCode 2.4.2** · 插件 **v0.1.0** · MIT · 仅服务端插件

把远端 Magpie 模型网关的 `/v1/models` 目录同步为 OpenCode 原生模型提供方。安装后，Magpie 上的模型会直接出现在 `/models` 选择器中，无需在每台开发机手工维护模型 ID。

典型场景：Windows 上的 OpenCode 通过内网访问 Linux 上的 Magpie，模型增删由 Magpie 侧统一管理。

[English](README.en.md) · [文档索引](docs/README.md) · [架构](docs/ARCHITECTURE.md) · [配置](docs/CONFIGURATION.md) · [部署手册](docs/DEPLOYMENT.md)

---

## 能力概览

| 能力 | 行为 |
| --- | --- |
| 单一 Provider | 注册一个 `magpie` provider，显示名 **Magpie Gateway** |
| 自动发现 | 轮询 `<baseURL>/models`，默认 30 秒，范围 10–3600 秒 |
| 原生选择器 | 模型出现在 OpenCode `/models`，选择 ID 为 `magpie/<原始模型 ID>` |
| 完整标签 | 优先使用 Magpie `magpie_label`，保留分组信息 |
| 路由透明 | 推理请求中的 `model` 字段保持 Magpie 原始 ID，包括多级斜杠 |
| 失败保留 | 发现失败保留最近一次有效内存目录，恢复后自动继续同步 |
| 空目录防抖 | 连续两次**有效**空响应才清空目录；错误会打断计数 |
| 凭据隔离 | Bearer Key 仅存在于插件内存或服务进程环境变量，不写入 provider 定义或日志 |
| 边界收紧 | 发现请求拒绝重定向、限制 8 MiB 与超时；推理请求校验目标 origin 与路径前缀 |
| 无持久化 | 不写数据库、不落盘缓存、不上传遥测；重启后重新发现 |

## 环境要求

| 项目 | 要求 |
| --- | --- |
| OpenCode | **2.4.2**（本版本已按该宿主适配；升级宿主需重新验收） |
| Node.js | 构建与测试使用 `^22.12.0`、`^24.0.0` 或 `>=26`；实测 24.22.1 |
| 网络 | OpenCode 服务进程可访问 Magpie 网关地址与端口 |
| 凭据 | 具备目录读取和目标模型调用权限的 Magpie Gateway Key |
| 工具链 | TypeScript 5.9.3、Vitest 5.1.1，均由 `package-lock.json` 锁定 |

## 安装

### 1. 构建插件

在项目目录执行：

```powershell
npm ci
npm run check:package
```

`check:package` 会编译 TypeScript 并验证包入口可被 Node 加载。实际加载入口为 `dist/index.js`；修改源码后必须重新构建。

### 2. 写入 OpenCode 配置

用 `opencode debug paths` 确认服务端配置目录，将下面条目合并进 `opencode.json` 的 `plugins` 数组，替换包路径、`baseURL` 与 Gateway Key：

```json
{
  "plugins": [
    {
      "package": "file:///C:/Users/YOUR_NAME/dev/opencode-magpie-sync",
      "options": {
        "baseURL": "http://192.0.2.10:3425/v1",
        "gatewayKey": "REPLACE_WITH_MAGPIE_GATEWAY_KEY",
        "refreshSeconds": 30,
        "timeoutMs": 5000
      }
    }
  ]
}
```

完整字段、环境变量凭据和 URL 规则见 [配置参考](docs/CONFIGURATION.md)。示例文件：[opencode.example.jsonc](opencode.example.jsonc)。

### 3. 重启宿主

```powershell
opencode service restart
opencode service status
```

使用 `--standalone` 时退出并重新启动该进程。源码与依赖更新不会自动替换已运行实例。

### 4. 验收目录

```powershell
opencode models
```

应看到 `magpie/<原始模型 ID>` 条目。也可以在 TUI 中打开 `/models`，确认 **Magpie Gateway** 下的名称与 ID。

> 本仓库的自动验收**不发送聊天或生成请求**。模型生成能力请按你的实际网关单独验证。

## 配置要点

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `baseURL` | 必填 | Magpie 网关地址，通常含 `/v1`；保留代理路径前缀 |
| `gatewayKey` | 无 | 非空时优先于环境变量；明文保存在本机配置 |
| `refreshSeconds` | `30` | 目录刷新周期，整数，越界收敛到 10–3600 |
| `timeoutMs` | `5000` | 单次目录发现超时，整数，越界收敛到 1000–30000 |

也可通过服务进程的 `MAGPIE_GATEWAY_KEY` 提供密钥。两种方式同时覆盖目录发现与推理鉴权；非空 `options.gatewayKey` 优先。

URL 必须为 `http` 或 `https`，不得内嵌账号密码、查询参数或片段。`/proxy/v1` 这类前缀会被保留，插件不会自动改写或探测其他路径。

## 模型映射

Magpie 目录条目到 OpenCode 模型的映射：

| Magpie 字段 | OpenCode 行为 |
| --- | --- |
| `id` | 原样作为 wire model ID；选择引用增加 `magpie/` 前缀 |
| `magpie_label` | 优先作为显示名，保留 Magpie 分组名称 |
| `name` / `display_name` | `magpie_label` 缺失时依次回退，最终回退到 `id` |
| `type` | 接受 `chat`、`model` 或未提供；其他字符串类型跳过 |
| `context_window` | 正安全整数映射到上下文限额，否则为 `0` |
| `max_output_tokens` | 正安全整数映射到输出限额，否则为 `0` |

工具能力固定关闭，仅声明文本输入/输出，费用为空。视觉、工具调用、推理等级、价格与多协议路由暂未映射。

## 运行行为

- **刷新**：首次加载立即发现一次，之后按周期轮询。重叠触发合并为一次进行中的请求。
- **提交**：目录排序后计算签名；ID、名称或限额变化才调用 `ctx.provider.reload()`，仅顺序变化不触发。
- **失败**：HTTP、网络、超时或解析错误不会清空已有目录；日志保留通用错误，避免回显敏感响应。
- **空目录**：已有有效目录时，一次空响应被忽略；连续第二次有效空响应才提交空目录。
- **重启**：目录只驻留内存。离线启动时目录为空，恢复连接后自动填充。
- **卸载**：停止定时器、等待进行中的有界发现、释放鉴权钩子与 provider 注册。

## 安全边界

- Gateway Key 不会写入 provider 定义、模型信息或日志；推理鉴权通过宿主最终 HTTP 钩子注入。
- 发现请求设置 `redirect: "error"`、5 秒默认超时和 8 MiB 响应上限。
- 推理请求在注入 Bearer 前校验目标 origin 与配置的路径前缀，并再次禁止重定向。
- 插件不扫描网络、不启动 Magpie 进程、不读取无关凭据、不上传遥测。
- 配置端点由可信操作者指定，允许内网与回环地址；这**不是**通用 SSRF 防护或网络隔离边界。
- HTTP 不加密链路。跨不可信网段时请使用受控 HTTPS 网关或隧道。

漏洞报告与威胁模型见 [SECURITY.md](SECURITY.md)；依赖现状见 [依赖审查](docs/DEPENDENCY-REVIEW.md)。

## 验证状态

本版本针对 **OpenCode 2.4.2 / SDK 2.4.2** 适配，已完成：

- TypeScript 严格检查通过；
- **18/18** 单元测试通过；
- 包构建与入口加载通过；
- 真实 OpenCode 2.4.2 + 本地模拟目录的宿主检查通过，明确报告 **零推理请求**。

本次适配**未执行**模型生成、真实 Magpie 联调或网络断开演练。历史 2.3.2 联调记录（真实 Linux 网关、96 个模型、一次文本生成）仅作追溯，不作为 2.4.2 推理验收依据。完整证据与未覆盖范围见 [验证范围](docs/VALIDATION.md)。

## 开发

```powershell
npm run check          # TypeScript 严格检查
npm test               # Vitest 单元测试
npm run check:package  # 构建 + 包入口加载
npm run verify         # 以上三项顺序执行
npm run test:host      # 真实宿主 + localhost 模拟目录（零推理）
```

宿主冒烟测试需要可执行的 `opencode`（或在 `OPENCODE_BIN` 指定路径）。详见 [开发指南](docs/DEVELOPMENT.md)。

## 文档

| 文档 | 面向 |
| --- | --- |
| [文档索引](docs/README.md) | 全部文档的阅读顺序与用途 |
| [架构设计](docs/ARCHITECTURE.md) | 组件边界、数据流、状态机与设计取舍 |
| [兼容性策略](docs/COMPATIBILITY.md) | 宿主/SDK 版本策略与升级流程 |
| [配置参考](docs/CONFIGURATION.md) | 全部选项、凭据、URL 与目录策略 |
| [部署与验收](docs/DEPLOYMENT.md) | 生产上线、验收清单与回滚 |
| [运行规范](docs/OPERATIONS.md) | 日常运维、变更、凭据轮换与下线 |
| [开发指南](docs/DEVELOPMENT.md) | 工具链、测试分层、调试与代码约束 |
| [故障排查](docs/TROUBLESHOOTING.md) | 症状、原因、处置与升级材料 |
| [验证范围](docs/VALIDATION.md) | 已测、未测与证据边界 |
| [发布流程](docs/RELEASING.md) | 版本、制品、校验与发布门禁 |
| [依赖审查](docs/DEPENDENCY-REVIEW.md) | 审计结果、可达性与处置原则 |
| [变更记录](CHANGELOG.md) · [贡献规范](CONTRIBUTING.md) · [安全说明](SECURITY.md) | 协作与合规 |

## 版本策略

当前插件版本严格固定为 **v0.1.0**（`package.json` 中的 semver 形式为 `0.1.0`）。宿主适配、缺陷修复、文档与测试更新都不会自动改变版本号；任何版本变更均需维护者明确授权。

## 许可证

[MIT](LICENSE)。商业使用需自行确认 Magpie、上游模型服务与传递依赖各自的授权和服务条款。

## 卸载与回滚

从 `plugins` 数组移除本插件条目并重启对应服务或 standalone 进程即可卸载；无需删除宿主数据库。回滚时恢复旧包路径与匹配锁文件，重新构建并重启。网关配置与凭据由部署方保留。启动插件会自动读取配置网关目录；无模型测试请使用 `npm run test:host` 的 localhost 隔离环境，真实目录检查需单独授权。
