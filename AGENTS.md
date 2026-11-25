# 代理开发约束

## 必须遵守

- 插件版本严格保持 `0.1.0`（展示为 `v0.1.0`）；只有用户明确要求更新插件版本时才能变更。依赖升级、宿主适配、修复及文档更新不构成授权。
- 保持 package.json、package-lock.json 根包版本、包检查、文档及制品版本一致；依赖、宿主与配置 schema 版本独立管理。
- 未经用户明确授权，不执行模型调用测试，包括 localhost 模拟生成。不执行真实远端发现或真实凭据测试，除非任务明确授权。
- 使用隔离配置、数据目录、端口和测试密钥进行无模型验证；不修改日常宿主配置，不输出真实凭据。
- 先检查 git 状态并保留已有修改。完成授权范围内的修改和验证，准确记录失败、跳过及未测项。

## 开发入口

依次阅读 [统一工程规范](docs/ENGINEERING.md)、[架构](docs/ARCHITECTURE.md)、[开发](docs/DEVELOPMENT.md) 和 [贡献规范](CONTRIBUTING.md)。文档地图见 [索引](docs/README.md)，证据见 [验证范围](docs/VALIDATION.md)。公共工程规范变更须同步另一插件仓库。

## 项目特有契约

- 稳定标识：插件 `magpie.sync`，Provider `magpie`，模型 wire ID 保留 Magpie 原始值；入口 `dist/index.js`。
- core 无宿主依赖；目录内存快照保持单飞、排序签名、reload 失败回滚、连续两次有效空响应才清空，失败不推进空目录计数。
- 默认验证：`npm run verify`；无模型宿主使用 `npm run test:host`。
- `npm run test:host:inference` 和 `node tools/verify-live.mjs` 涉及生成，当前未经授权不得执行。
