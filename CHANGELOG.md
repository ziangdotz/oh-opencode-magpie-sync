# 变更记录

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的结构。版本号由维护者明确决定；当前严格保持 **v0.1.0**，本次适配不改变版本号。当前包为私有包，未发布 npm，未创建版本标签。

## 未发布变更（v0.1.0） · 2026-11-24

适配 OpenCode 2.4.1，并重写交付文档。**插件版本保持 v0.1.0 不变。** 本次未执行模型生成或真实 Magpie 联调。

### 变更

- 将 `@opencode/plugin` 与锁文件精确升级到 **2.4.1**，与本地 OpenCode 2.4.1 对齐。
- `http.request` 鉴权钩子改用 `{ providerID: "magpie" }` 作用域注册，保留内部 provider 与目标 URL 复核。
- 配置读取统一规范化：`baseURL` 去空白并规范化，`gatewayKey` 去首尾空白，数值越界收敛，未知选项告警后忽略。
- **`baseURL` 改为必填**：移除硬编码的内网默认地址，缺失时在 setup 阶段快速失败，避免把密钥发往非预期主机。
- 卸载阶段改为并行释放鉴权钩子与 provider 注册，单步失败不再阻断另一步。
- 补充选项边界、URL 拒绝与钩子作用域测试，测试数从 15 增至 **18**。

### 验证

- 类型检查通过；18/18 单元测试通过；包入口加载通过。
- 真实 OpenCode 2.4.1 + localhost 模拟目录通过，明确报告**零推理请求**。
- `npm audit`：24 moderate、0 high、0 critical。
- 未执行：模拟推理、真实 Magpie、断网恢复、TUI 传播、全部模型生成。

### 文档

- 重写中文/英文 README，补齐能力、安装、配置、安全、验证与文档索引。
- 重写架构、配置、部署、运行、开发、排障、验证、发布与依赖审查文档。
- 新增 [兼容性策略](docs/COMPATIBILITY.md) 与 [文档索引](docs/README.md)。
- 更新 `package.json` 元数据（描述、许可证、仓库、关键词、`verify` 脚本）与 CI 矩阵。

## v0.1.0 · 2026-11-22

首个本地开发基线。注册单一 Magpie Gateway provider，从远端 `/v1/models` 自动发现模型。

### 新增

- `magpie` provider 注册，显示名 **Magpie Gateway**，模型进入 OpenCode 原生 `/models`。
- 目录解析：保留原始模型 ID（含多级斜杠），优先 `magpie_label`，回退 `name`/`display_name`/`id`。
- 支持 `type=chat`、`type=model` 与缺失类型；过滤其他显式类型。
- 目录校验：拒绝空/首尾空白/控制字符/`#` ID，拒绝重复 ID，限制 8 MiB，超时默认 5 秒。
- 默认 30 秒轮询；排序后签名，仅 ID/名称/限额变化触发 reload。
- 失败保留最近有效目录；连续两次有效空响应才清空；错误打断空目录计数。
- 发现与推理统一 Bearer 鉴权；推理钩子校验 origin/路径前缀并拒绝重定向。
- 凭据支持 `options.gatewayKey` 与服务进程 `MAGPIE_GATEWAY_KEY`，JSON 优先。
- 支持反向代理路径前缀；不自动探测或改写路径。
- `core` / `server` 分层，编译器输出 ESM，Windows/Linux CI 配置。
- 15 项单元测试；中英文 README 与配置、运行、开发、排障、发布、验证、安全文档。

### 兼容性

- 历史基线：OpenCode / SDK 2.3.2，Windows / Node.js 24.22.1。

### 验证

- 真实 Linux Magpie：`/v1/models` 鉴权 HTTP 200；96 个模型 ID 与 OpenCode 一致。
- 96 个模型显示名与 `magpie_label` 一致；wire ID 未改写。
- `trae-cn/Doubao-Seed-2.1-Turbo` 完成一次真实文本生成，返回 `MAGPIE_SYNC_OK`。
- 证据见 [docs/live-validation.json](docs/live-validation.json)。该记录仅代表 2.3.2 历史快照。

### 已知限制

- 仅 OpenAI-compatible Chat；工具关闭，仅文本输入输出。
- 仅读取一页目录；不映射视觉、工具、推理等级、价格或 native endpoints。
- 目录仅驻留内存；无跨重启缓存。
- 未验证 TUI 增删传播、断网实网演练、全部模型生成与限额为 0 的宿主行为。
