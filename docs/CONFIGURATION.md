# 配置

配置示例见 [opencode.example.jsonc](../opencode.example.jsonc)。插件 options 位于 `plugins` 数组内的包条目中，不是 OpenCode 顶层字段。修改后重启服务或 standalone 进程，插件会重新读取选项。

## 插件选项

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| baseURL | http://192.168.22.100:3425/v1 | 用户指定的 Magpie HTTP(S) 网关，通常包含 /v1 |
| gatewayKey | 无 | 非空字符串优先于环境变量；使用 Linux Magpie Gateway Key |
| refreshSeconds | 30 | 整数，范围 10–3600 秒，越界值收敛到边界 |
| timeoutMs | 5000 | 目录发现超时，整数，范围 1000–30000 毫秒 |

数值选项不是整数时使用默认值。baseURL 不是字符串时使用默认地址；URL 必须为 HTTP(S)，不允许内嵌账号密码、查询参数或片段。路径前缀保留，例如 `/proxy/v1` 请求 `/proxy/v1/models`。不会自动探测其他地址或启动 Magpie。

未知 options 字段目前不会被严格拒绝；请只使用表中字段。timeoutMs 仅控制目录发现，不是推理超时配置。

## 密钥

可直接在本机 `opencode.json` 填写 `options.gatewayKey`，或使用服务端进程的 `MAGPIE_GATEWAY_KEY`。空字符串和纯空白 gatewayKey 回退到环境变量。JSON 优先，因此环境变量更新不会覆盖已有非空 JSON 密钥。

仅使用环境变量时，从启动 OpenCode 的同一个 PowerShell 设置：

```powershell
$secret = Read-Host 'Magpie Gateway Key' -AsSecureString
$env:MAGPIE_GATEWAY_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
opencode --standalone
```

已运行的后台服务不会继承新 shell 的变量。使用服务管理器配置服务环境并重启，或采用 JSON 方式。此插件不通过 `/connect` 管理凭据，也不读取上游厂商 token。

## 模型映射

| Magpie 数据 | OpenCode 行为 |
| --- | --- |
| id | 保留为模型 ID 和推理 modelID；选择引用增加 magpie/ 前缀 |
| magpie_label | 优先作为显示名，包含 Magpie 分组名称 |
| name / display_name | magpie_label 缺失时依次回退，最终回退到 id |
| context_window / max_output_tokens | 映射正安全整数；无效或缺失时写入 0 |
| type | 接受 chat、model 及未提供 type 的条目；其他字符串类型跳过 |

显示名不会改变路由。完整分组名显示在模型名称中，所有模型仍归于单个 **Magpie Gateway** provider，不建立分组 provider。

工具固定关闭，仅声明 text 输入输出，费用为空；Magpie 的视觉、工具、推理等级、价格和 native_endpoints 暂不映射。限制值 0 是本插件表示未提供数据的数值约定，宿主处理这些模型的输出和压缩行为仍需专项验证。

## 目录策略

发现只请求一页 `/models`，目前不跟随 has_more 或分页游标。响应上限为 8 MiB。模型 ID 不能为空、含首尾空白、控制字符或 `#`；有效入选条目的重复 ID 会拒绝整个快照。

每次成功解析后排序并比较签名，ID、名称或限额变化触发 reload；仅顺序变化不触发。已有目录在单次空响应后保留，连续第二次有效空响应才清空；HTTP、网络或解析错误打断该计数。目录仅驻留内存，重启后离线启动为空。
