# 版本记录

## 0.1.0

- 注册单一 Magpie Gateway provider，从远端 /v1/models 自动发现模型，保留嵌套 ID 和原始推理路由。
- 显示 Magpie 完整 magpie_label，包含原分组名，缺失时回退到模型名称或 ID。
- 支持 JSON gatewayKey 与环境变量凭据，为发现和推理统一发送 Bearer 鉴权。
- 默认 30 秒轮询，顺序变化不 reload，失败保留内存目录；连续两次有效空响应才清空。
- 保留反向代理路径，拒绝重定向，限制发现超时和响应大小，卸载释放注册和定时器。
- 按 core/server 分层，导出编译 JS，固定 SDK 2.3.2 及 lockfile，提供 Windows/Linux CI。
- 修复真实 Magpie type=model 的目录兼容；真实 Linux 96 个模型、完整标签和一次文本生成验证通过。
- 15 项自动测试通过；补齐中英文入口及配置、运行、开发、排障、发布、验证和安全文档。

当前仍为本地开发与交付基线，未发布 npm 包或创建版本标签。完整测试边界见 [验证范围](docs/VALIDATION.md)。
