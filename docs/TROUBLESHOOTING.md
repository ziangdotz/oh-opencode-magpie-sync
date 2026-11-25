# 故障排查

本文按“症状 → 可能原因 → 处置”组织。发现错误日志经过收敛，可能不包含 HTTP 状态；需要精确定位时按第 4 节在本机受控验证。

## 1. 快速分诊

```powershell
opencode --version
opencode service status
opencode models
opencode debug paths
```

| 观察 | 方向 |
| --- | --- |
| `opencode models` 完全没有 `magpie/*` | 插件未加载、配置未生效或注册冲突 |
| 有 `magpie/*` 但目录为空 | 发现失败或网关目录为空 |
| 有目录但缺少新增模型 | 刷新周期、上游目录或签名/传播问题 |
| 目录正常但聊天失败 | 推理鉴权、模型权限、协议或限额问题 |
| 宿主启动异常 | 包路径、构建产物、宿主版本兼容 |

## 2. 症状表

### 2.1 加载与配置

| 症状 | 可能原因 | 处置 |
| --- | --- | --- |
| 命令代理提示 Node.js 版本范围未安装 | npm 代理/引擎限制 | 使用真实 Node 安装目录运行 npm，或从无该项目 `engines` 的目录运行宿主；不要为绕过代理改写 engines |
| 找不到 Magpie Gateway | 配置目录不对、`plugins` 条目缺失、包路径错误 | 用 `opencode debug paths` 确认服务端配置；核对条目位于 `plugins` 数组 |
| 宿主加载不到包 | `dist/index.js` 缺失、未构建、路径不是持久目录 | 在包目录执行 `npm ci` 与 `npm run check:package`；确认配置指向包根目录 |
| 改了配置但不生效 | 只重新构建，未重启服务 | 重启服务或 standalone 进程 |
| `Ignoring unknown option` | 选项拼写错误或使用了旧字段 | 对照 [配置参考](CONFIGURATION.md) 修正；未知项会被忽略 |
| 启动即失败，提示 `Magpie baseURL is required` | 未配置 `baseURL`（该字段必填） | 在插件 options 中填写网关地址后重启 |
| 启动即失败，提示 HTTP(S) | `baseURL` 协议错误 | 仅使用 `http`/`https` |
| 启动即失败，提示 credentials/query/fragment | URL 含账号密码、`?` 或 `#` | 移除这些部分，凭据走 `gatewayKey`/环境变量 |
| `Magpie provider collision` | 其他插件或手工配置已注册 `magpie` | 只保留一个注册来源，移除重复条目 |
| 配置里有两个本插件条目 | 误以为能提高刷新频率 | 删除重复条目；多个网关当前不支持 |

### 2.2 目录为空或不完整

| 症状 | 可能原因 | 处置 |
| --- | --- | --- |
| 首次启动目录为空 | 网关不可达、密钥缺失、URL 前缀错误 | 查看 `Initial discovery unavailable`；按第 4 节验证端点 |
| 目录为空且日志无 `Catalog synced` | 发现持续失败 | 检查网络、DNS、端口、代理、TLS |
| 登录后仍 401/403 | Key 无效、无目录权限、优先级误判 | 确认非空 `options.gatewayKey` 优先；否则检查服务环境变量 |
| 新 shell 设置密钥无效 | 已运行服务不继承新变量 | 配置服务管理器环境并重启，或使用 JSON 后重启 |
| 目录突然清空 | 连续两次有效空响应 | 检查 Magpie 是否真的返回空目录；恢复后等待下一周期 |
| 目录一直不更新 | 发现失败保留旧目录；或上游未变 | 查看 `Refresh failed`；对比 Magpie 目录 |
| 只有部分模型 | 上游单页返回不完整；非 chat 类型被过滤 | 当前不支持分页；确认 `type` 字段 |
| 整份目录被拒绝 | JSON 结构错误、重复 ID、不安全 ID | 检查 Magpie 返回：`data` 数组、ID 无空白/`#`/控制字符、无重复 |
| 发现响应过大 | 超过 8 MiB | 优化网关返回；插件会保留旧目录 |
| TLS 证书错误 | 自签名/企业 CA 未受信 | 在服务进程环境中配置受信 CA；插件不跳过证书校验 |

### 2.3 模型显示与选择

| 症状 | 可能原因 | 处置 |
| --- | --- | --- |
| 分组名未显示 | `magpie_label` 缺失或含控制字符 | 检查上游字段；回退到 `name`/`display_name`/`id` |
| 模型 ID 带前缀不习惯 | 选择引用固定为 `magpie/<id>` | 这是宿主行为；wire `model` 仍是原始 ID |
| 新增模型 TUI 看不到 | 服务端未提交或 TUI 缓存未传播 | 确认日志 `Catalog synced`；重新打开 `/models`；记录宿主传播问题 |
| 删除模型仍显示 | 尚未到刷新周期或 TUI 缓存 | 等待刷新；确认服务端注册表已更新 |
| 模型数量与 Magpie 不一致 | 非 chat 类型被过滤、重复 ID 被拒绝、分页 | 对照第 2.2 节 |
| 限额显示 0 | 上游缺少 `context_window`/`max_output_tokens` | 属当前约定；宿主对 0 的输出/压缩行为未验证 |

### 2.4 推理

> 推理失败通常是网关或模型问题，不是目录同步问题。以下仅供分诊。

| 症状 | 可能原因 | 处置 |
| --- | --- | --- |
| 401/403 | 推理鉴权缺失、Key 权限不足 | 确认发现与推理使用同一 Key；检查 Magpie 权限 |
| `Magpie request outside configured gateway` | 驱动请求的 origin/路径与前缀不符 | 检查 `baseURL` 与反向代理路径；`/chat/completions` 必须同前缀 |
| `Magpie gateway key unavailable` | 钩子执行时无密钥 | 配置 JSON Key 或服务环境变量并重启 |
| 404 | 网关未转发 `/chat/completions` 或前缀错误 | 修正代理路由 |
| 超时 | 上游慢或网络问题 | 属推理超时，`timeoutMs` 不控制推理 |
| 模型不存在/无权限 | 目录包含但上游不可用 | 由 Magpie 管理员核对路由 |
| 工具/图片不可用 | 插件仅声明文本、工具关闭 | 当前不支持；远端支持不代表插件已映射 |
| 输出被截断/压缩异常 | 限额为 0 或上游限额不准 | 补齐目录限额；记录宿主行为 |

### 2.5 卸载与清理

| 症状 | 可能原因 | 处置 |
| --- | --- | --- |
| `Cleanup step failed` | 宿主释放钩子/注册时抛错 | 另一步仍会释放；记录脱敏错误并重启宿主 |
| 停止后仍有刷新日志 | 日志来自其他进程或旧实例 | 确认服务/standalone 是否真正停止 |

## 3. 日志定位

| 日志 | 含义 | 下一步 |
| --- | --- | --- |
| `Catalog synced: N models` | 目录已提交注册表 | 若 TUI 未变，查传播而非发现 |
| `Initial discovery unavailable` | 首次发现失败 | 查网络、密钥、URL |
| `Refresh failed; keeping last catalog` | 轮询失败 | 查网关可用性；旧目录仍可用 |
| `Ignoring unknown option` | 配置字段无效 | 修正拼写 |
| `Cleanup step failed` | 卸载部分失败 | 重启宿主，收集日志 |

日志不包含密钥、请求头或响应体。不要为了排障临时添加会打印这些内容的代码到生产。

## 4. 受控验证发现端点

在**能访问网关的受控机器**上验证，不要粘贴真实密钥到工单：

```powershell
$headers = @{ Authorization = "Bearer $env:MAGPIE_GATEWAY_KEY" }
$response = Invoke-WebRequest -Uri 'http://192.0.2.10:3425/v1/models' -Headers $headers -UseBasicParsing
$response.StatusCode
$response.RawContentLength
($response.Content | ConvertFrom-Json).data.Count
```

只关注状态码、大小与数量。若需要检查 ID，使用脚本过滤，不要把完整响应贴出。

| 结果 | 结论 |
| --- | --- |
| 200，数量合理 | 网关正常，问题在宿主配置/加载/传播 |
| 401/403 | 密钥或权限问题 |
| 404 | URL 前缀或路由错误 |
| 超时/连接失败 | 网络、防火墙、DNS、服务未启动 |
| 200 但 JSON 结构异常 | 上游目录格式问题 |
| 200 但数量为 0 | 上游确实为空 |

## 5. 平台注意事项

### Windows

- `file:///C:/...` 使用正斜杠与盘符；不要使用 `C:\` 原始反斜杠形式。
- 后台服务与当前 shell 的环境变量相互独立。
- 防火墙需允许服务进程访问网关端口。
- `opencode service restart` 与 `--standalone` 是不同进程模型。

### Linux / 容器

- 服务账号需要读取包目录与配置文件。
- 容器内 `127.0.0.1` 指容器自身，不是宿主机；使用可达的服务名/IP。
- 自签名证书需在容器信任库中配置。

### 代理

- `baseURL` 必须包含代理要求的前缀；
- 代理必须同时转发 `/models` 与 `/chat/completions`；
- 插件本身不配置网络代理；如部署环境必须经代理出网，请在宿主或网络层提供，并确保代理保留路径前缀。

## 6. 升级材料

报告问题时提供：

- 插件版本、OpenCode 版本、SDK 版本、Node.js 版本；
- 操作系统与服务形态（service / standalone / 容器）；
- 复现步骤与发生时间；
- 脱敏后的错误消息与日志片段；
- `baseURL` 的**路径结构**（可隐藏主机名）；
- 具体模型 ID（如 `group/model`）；
- 是否使用环境变量凭据（不要提供值）。

不要提供：

- Gateway Key、服务密码、完整 `opencode.json`；
- 数据库、完整响应体、请求头；
- 未脱敏的截图或终端历史。

## 7. 升级路径

若确认是宿主/SDK 兼容问题，不要在生产直接改依赖。按 [兼容性策略](COMPATIBILITY.md) 在候选目录升级 SDK、运行 `npm run verify` 与 `npm run test:host`，再走部署验收与回滚准备。
