# 验证范围

基线：插件 v0.1.0，OpenCode / SDK 2.3.2。记录日期：2026-11-22。以下为当前有效结果，历史 starter 状态不再适用。

## 兼容矩阵

| 环境或范围 | 结果 |
| --- | --- |
| Windows / Node.js 24.22.1 / OpenCode 2.3.2 | 本机通过类型、测试、构建和宿主验证 |
| SDK 2.3.2 | 已核对注册、只读模型信息、reload、dispose 和 HTTP hook |
| Windows/Linux、Node 22/24 CI | 已配置，尚无远端 Actions 通过记录 |
| 其他 OpenCode / Node 版本 | 未作兼容承诺 |

## 已通过

| 检查 | 证据 |
| --- | --- |
| npm install / 干净 npm ci | 依赖安装及 lockfile 生成通过；干净验证使用 --ignore-scripts |
| npm run check | TypeScript 5.9.3 检查通过 |
| npm test | 15 项测试通过 |
| npm run check:package | JS 构建及 Node 包导出加载通过 |
| npm pack --dry-run | 文档重写后重新通过，构建成功，清单包含新增文档 |
| 真实 OpenCode + 模拟网关 | 本地包加载、发现鉴权、嵌套 ID、SSE 推理和 wire model 校验通过 |
| 真实 Linux Magpie | /v1/models 鉴权 HTTP 200；96 个 ID 与 OpenCode 完全一致 |
| 真实服务文本生成 | trae-cn/Doubao-Seed-2.1-Turbo 返回 MAGPIE_SYNC_OK，退出码 0 |
| 完整分组标签 | 96 个宿主模型名称均与 Magpie magpie_label 一致，ID 不变 |
| 用户终端反馈 | 用户确认测试可用；不扩展为全部场景验收 |

真实生成结果见 [live-validation.json](live-validation.json)。该文件记录一次真实联调快照，不代表目录始终为 96 个模型。完整标签比对在后续单独检查，未写入该 JSON。

自动测试覆盖解析、类型兼容、完整显示标签、限额、重复及不安全 ID、排序、代理路径、HTTP 错误、无效数据、超时、拒绝重定向、发现和推理鉴权、无效快照保留、重连、空目录确认、无变化刷新、重叠刷新、reload 失败重试、日志脱敏及清理。

## 待完成范围

- 保持同一 TUI 运行，在 Magpie 增删模型后验证选择器传播时间。
- 真实网络断开两轮轮询再恢复；当前恢复逻辑有自动测试，尚无该实网演练。
- 所有目录模型逐个推理、未知限额为 0 时的宿主输出/压缩行为。
- 工具调用、视觉、Responses、reasoning variants 及其他协议；当前插件未启用这些映射。
- Magpie 多页目录；当前实现只读取一页。

## 手工复验

使用测试模型执行 `node tools/verify-live.mjs`，用法和真实请求影响见 [开发](DEVELOPMENT.md)。另保持 TUI 运行，在 Magpie 添加/删除模型，记录 Catalog synced 与 `/models` 变化时间。单独记录服务端已更新而选择器未变化的情况。

在可中断的测试环境断网至少两个刷新周期，确认目录保留；恢复后等待下一次有效轮询。再验证一次空响应、连续两次空响应和无效 JSON，避免将模拟测试结论代替实网记录。

依赖审计状态见 [依赖审查](DEPENDENCY-REVIEW.md)。没有发布、创建版本标签或更新包版本。
