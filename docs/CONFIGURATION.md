# 配置参考

插件的全部可配置项位于 OpenCode 服务端配置中 `plugins` 数组的包条目内，不是 OpenCode 顶层字段。修改后需要重启服务或 standalone 进程。

完整示例见 [opencode.example.jsonc](../opencode.example.jsonc)。

## 1. 配置位置与结构

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

| 字段 | 含义 |
| --- | --- |
| `package` | 插件包目录的 `file://` URL 或已安装包路径；宿主实际加载 `dist/index.js` |
| `options` | 本插件读取的配置对象；未知键会告警并忽略 |

使用 `opencode debug paths` 确认服务端配置目录。将条目合并进现有 `plugins` 数组，不要覆盖其他插件条目。

## 2. 选项参考

| 选项 | 类型 | 默认值 | 合法范围 | 必填 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `baseURL` | string | 无（必填） | `http`/`https` URL，无凭据、查询串、片段 | **是** | Magpie 网关基地址，通常含 `/v1`；路径前缀保留 |
| `gatewayKey` | string | 无 | 非空字符串 | 二选一 | Magpie Gateway Key；非空时优先于环境变量 |
| `refreshSeconds` | integer | `30` | 10–3600 | 否 | 目录刷新周期；越界收敛到边界，非整数使用默认值 |
| `timeoutMs` | integer | `5000` | 1000–30000 | 否 | 单次目录发现超时；越界收敛到边界，非整数使用默认值 |

### 2.1 类型与边界行为

- `baseURL` 必填。缺失、非字符串或为空白时，插件在 setup 阶段抛出 `Magpie baseURL is required`，不会注册 provider，也不会把凭据发往任何默认地址。
- `gatewayKey` 会去除首尾空白；空白字符串视为未提供，回退到环境变量。
- `refreshSeconds` 与 `timeoutMs` 必须是安全整数；小数、字符串、`NaN` 均使用默认值。
- 越界整数不会报错，而是收敛到最近边界；这是为了容忍配置漂移，不应用于精确控制。
- 未知 `options` 键会在启动时输出 `[magpie.sync] Ignoring unknown option "<key>"`，随后忽略。拼写错误不会导致启动失败，但会使该配置无效。

### 2.2 不可配置项

以下行为由实现或宿主固定，当前没有配置项：

- provider ID（`magpie`）、显示名（`Magpie Gateway`）与驱动包；
- 模型能力（工具关闭、文本输入输出）；
- 发现响应上限（8 MiB）与重定向策略（拒绝）；
- 推理请求超时、重试与代理设置（由宿主管理）；
- 模型默认选择（插件不修改默认模型）；
- 目录落盘缓存（不提供）。

## 3. 凭据

### 3.1 来源与优先级

| 来源 | 设置位置 | 优先级 | 生效时机 |
| --- | --- | --- | --- |
| `options.gatewayKey` | `opencode.json` 插件条目 | 高 | 插件 setup 时读取，修改后需重启 |
| `MAGPIE_GATEWAY_KEY` | OpenCode 服务进程环境 | 低 | 每次发现/推理请求时读取 |

规则：

1. 非空 `options.gatewayKey` 始终优先；环境变量更新不会覆盖它。
2. JSON 与环境变量中的首尾空白都会被去除；空白值视为未提供。
3. 两者都缺失时，首次发现失败并保留空目录；推理请求在钩子处失败，不会匿名发送。
4. 两种来源同时覆盖目录发现与推理鉴权，不存在“发现可用但推理无鉴权”的混合状态。
5. 本插件不通过 `/connect`、系统凭据库或 OAuth 管理该密钥。

### 3.2 使用环境变量

从启动 OpenCode 的同一个会话设置：

```powershell
$secret = Read-Host 'Magpie Gateway Key' -AsSecureString
$env:MAGPIE_GATEWAY_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
opencode --standalone
```

后台服务不会继承新 shell 的变量。请通过服务管理器配置服务环境并重启，或改用 JSON 方式。

### 3.3 密钥卫生

- JSON 中的密钥是**明文**，只应放在受控本机用户配置中。
- 备份、日志、问题单、截图与聊天记录不得包含密钥。
- 轮换密钥时：先更新配置或服务环境 → 重启宿主 → 确认目录与推理正常 → 再吊销旧密钥。
- 发现请求失败时日志只输出通用错误，不回显请求头或响应体。

## 4. URL 语义

### 4.1 校验规则

`baseURL` 必须满足：

- 协议为 `http:` 或 `https:`；
- 不含 `username` / `password`；
- 不含查询串（`?`）或片段（`#`）；
- 可包含任意路径前缀。

插件会去除末尾斜杠并规范化 URL，然后请求 `<baseURL>/models`。

### 4.2 示例

| 配置 | 发现请求 | 说明 |
| --- | --- | --- |
| `http://192.0.2.10:3425/v1` | `http://192.0.2.10:3425/v1/models` | 常见部署 |
| `https://gw.example.test/proxy/v1/` | `https://gw.example.test/proxy/v1/models` | 保留 `/proxy` 前缀 |
| `http://127.0.0.1:8080` | `http://127.0.0.1:8080/models` | 无路径前缀 |
| `https://alice:secret@gw/v1` | 启动失败 | 禁止内嵌凭据 |
| `https://gw/v1?tenant=a` | 启动失败 | 禁止查询串 |
| `ftp://gw/v1` | 启动失败 | 仅支持 HTTP(S) |

插件**不会**自动探测 `/v1`、`/api` 或其他路径，也不会重写代理前缀。网关前缀必须由配置准确表达。

### 4.3 推理路径

推理由 `@opencode/ai/providers/openai-compatible` 驱动，请求路径为 `<baseURL>/chat/completions`。鉴权钩子校验：

- 目标 origin 必须与 `baseURL` 的 origin 完全一致；
- 目标 pathname 必须以 `baseURL + "/"` 为前缀。

因此自定义反向代理必须同时转发 `/models` 与 `/chat/completions`，且保持同一路径前缀。

## 5. 模型映射

| Magpie 字段 | 类型 | 映射 |
| --- | --- | --- |
| `id` | string | 原样作为模型 ID / wire `model`；选择引用为 `magpie/<id>` |
| `type` | string | `chat`、`model` 或缺失时入选；其他字符串类型跳过；非字符串类型不参与过滤 |
| `magpie_label` | string | 优先显示名；含控制字符时忽略 |
| `name` | string | `magpie_label` 缺失时使用 |
| `display_name` | string | 前两者缺失时使用 |
| 全部缺失 | — | 回退到 `id` |
| `context_window` | number | 正安全整数 → 上下文限额；否则 `0` |
| `max_output_tokens` | number | 正安全整数 → 输出限额；否则 `0` |

模型固定属性：

```text
capabilities: { tools: false, input: ["text"], output: ["text"] }
cost: []
status: active
enabled: true
```

显示名不改变路由。完整 Magpie 分组名仅体现在显示名中，所有模型仍归入单一 **Magpie Gateway** provider。

### 5.1 目录清洗规则

以下条目会导致**整个快照被拒绝**，而不是跳过单条：

- `data` 不是数组；
- 条目不是对象；
- `id` 为空、含首尾空白、含 `#` 或控制字符；
- 有效入选条目存在重复 ID。

非 chat 条目（例如 `embedding`）会在去重前被跳过，因此不会因其 ID 已存在而导致失败。注意：所有条目的 `id` 仍先经过格式校验；非 chat 条目若含不安全 ID，也会拒绝整个快照。

## 6. 目录发现策略

| 项目 | 行为 |
| --- | --- |
| 请求方法 | `GET <baseURL>/models` |
| 请求头 | `Authorization: Bearer <key>`、`Accept: application/json` |
| 重定向 | `redirect: "error"`，任何重定向视为失败 |
| 超时 | `timeoutMs`，默认 5000 ms |
| 响应上限 | 8 MiB（`content-length` 与流式累计双重检查） |
| 分页 | 不跟随 `has_more` 或游标，只读取一页 |
| 解析 | 严格 JSON；结构不符即失败 |
| 排序 | 按 ID 字典序 |
| 变更检测 | 排序后签名；ID、名称、上下文/输出限额变化才触发 reload |

### 6.1 刷新与保留

- 首次加载立即发现一次；失败不阻止宿主启动。
- 之后按 `refreshSeconds` 轮询；重叠触发合并为一次进行中请求。
- 失败（HTTP、网络、超时、解析）保留最近一次有效内存目录，并将空目录计数归零。
- 已有目录时，第 1 次有效空响应被忽略；第 2 次**连续**有效空响应才清空。
- 非空目录重置空目录计数。
- 仅顺序变化不触发 `reload()`。
- 目录只驻留内存；重启后离线启动为空。

### 6.2 日志

| 日志 | 含义 |
| --- | --- |
| `[magpie.sync] Catalog synced: N models` | 新目录已提交到注册表（不代表 TUI 已刷新） |
| `[magpie.sync] Initial discovery unavailable: ...` | 首次发现失败，宿主继续启动并重试 |
| `[magpie.sync] Refresh failed; keeping last catalog: ...` | 轮询失败，保留旧目录 |
| `[magpie.sync] Ignoring unknown option "<key>"` | 配置存在未知字段 |
| `[magpie.sync] Cleanup step failed: ...` | 卸载阶段某一步失败，另一资源仍会释放 |

发现错误消息经过收敛，可能不包含具体 HTTP 状态；定位方法见 [故障排查](TROUBLESHOOTING.md)。

## 7. 多条目与冲突

- 同一宿主只允许一个 `magpie` provider 注册来源。
- 如果其他插件或手工配置已注册 `magpie`，本插件在 transform 阶段抛出 `Magpie provider collision`。
- 不要通过重复添加本插件条目来“提高刷新频率”；会导致冲突或重复钩子。
- 多个 Magpie 网关应部署为多个独立 provider，需要改代码，当前不支持。

## 8. 调优建议

| 场景 | 建议 |
| --- | --- |
| 内网稳定、模型变动少 | `refreshSeconds` 60–300，降低网关压力 |
| 频繁增删模型 | `refreshSeconds` 10–30，并接受更高的发现流量 |
| 网关跨广域网、延迟高 | `timeoutMs` 10000–20000 |
| 网关响应很大（数百模型） | 保持默认 8 MiB 上限；确认单页返回完整目录 |
| 需要链路加密 | 配置受控 HTTPS 网关；插件不终止 TLS |
| 密钥轮换 | 优先环境变量 + 服务管理器，避免明文 JSON |

## 9. 配置自检清单

- [ ] `baseURL` 可从 OpenCode 服务进程访问，且包含正确的路径前缀。
- [ ] `gatewayKey` 或 `MAGPIE_GATEWAY_KEY` 至少一个有效。
- [ ] 配置条目位于 `plugins` 数组内，`package` 指向包含 `dist/index.js` 的目录。
- [ ] 没有第二个 `magpie` 注册来源。
- [ ] 修改后已重启服务，而不是只重新构建。
- [ ] 用 `opencode models` 看到 `magpie/*`，且名称/ID 符合预期。
- [ ] 没有把真实密钥写入仓库、日志或工单。
