# 文档索引

共同分层、开发流程、文档职责与验证授权见 [统一工程规范](ENGINEERING.md)。项目专属规则见本文。

本目录是 `opencode-magpie-sync` 的运维与开发文档集。根目录的 [README](../README.md) 提供最短上手路径；本索引说明每份文档的用途、读者与阅读顺序。

## 推荐阅读顺序

| 角色 | 顺序 |
| --- | --- |
| 首次部署 | [README](../README.md) → [配置](CONFIGURATION.md) → [部署与验收](DEPLOYMENT.md) → [故障排查](TROUBLESHOOTING.md) |
| 日常运维 | [运行规范](OPERATIONS.md) → [故障排查](TROUBLESHOOTING.md) → [验证范围](VALIDATION.md) |
| 二次开发 | [架构](ARCHITECTURE.md) → [开发指南](DEVELOPMENT.md) → [兼容性策略](COMPATIBILITY.md) → [贡献规范](../CONTRIBUTING.md) |
| 升级宿主 | [兼容性策略](COMPATIBILITY.md) → [验证范围](VALIDATION.md) → [开发指南](DEVELOPMENT.md) |
| 发布交付 | [发布流程](RELEASING.md) → [部署与验收](DEPLOYMENT.md) → [依赖审查](DEPENDENCY-REVIEW.md) |
| 安全评审 | [安全说明](../SECURITY.md) → [架构](ARCHITECTURE.md) → [依赖审查](DEPENDENCY-REVIEW.md) |

## 文档清单

| 文档 | 内容 | 主要读者 |
| --- | --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 包边界、组件职责、数据流、刷新状态机、鉴权链路、设计取舍与已知限制 | 开发、架构、安全 |
| [COMPATIBILITY.md](COMPATIBILITY.md) | 宿主与 SDK 版本策略、使用的 API 面、升级与回滚流程 | 开发、运维 |
| [CONFIGURATION.md](CONFIGURATION.md) | 全部选项、凭据来源与优先级、URL 规则、模型映射、目录策略 | 部署、运维 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 交付目标、前置条件、上线步骤、无生成验收、回滚 | 部署、运维 |
| [OPERATIONS.md](OPERATIONS.md) | 服务生命周期、健康信号、例行检查、变更窗口、凭据轮换、下线 | 运维 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 工具链、命令、测试分层、调试方法、代码约束 | 开发 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 症状—原因—处置表、诊断命令、升级材料 | 运维、支持 |
| [VALIDATION.md](VALIDATION.md) | 当前适配证据、兼容矩阵、已测/未测边界、手工复验步骤 | 全体 |
| [RELEASING.md](RELEASING.md) | 版本策略、发布门禁、制品与校验、发布说明模板 | 维护者 |
| [DEPENDENCY-REVIEW.md](DEPENDENCY-REVIEW.md) | 审计结果、传递依赖可达性、修复原则与复现命令 | 安全、维护者 |
| [SECURITY.md](../SECURITY.md) | 密钥处理、网络边界、威胁模型、漏洞报告 | 安全、运维 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 提交前检查、变更同步要求、禁止提交的内容 | 贡献者 |
| [CHANGELOG.md](../CHANGELOG.md) | 版本变更与未发布内容 | 全体 |

## 文档约定

- **版本事实以代码与锁文件为准。** 当前插件版本严格固定为 **v0.1.0**；任何版本变更均需维护者明确授权。文档中的宿主、SDK、Node.js 与测试数量均对应仓库当前状态。
- **证据分级。** “自动测试”“宿主模拟”“真实联调”“未验证”四种状态不会互相替代；[验证范围](VALIDATION.md) 是唯一权威汇总。
- **无生成验收。** 默认验收路径不发送模型生成请求；涉及真实调用的工具均在文档中显式标注。
- **安全默认值。** 文档不包含真实 Gateway Key、用户配置、数据库或完整响应体；示例一律使用占位符。
- **命令环境。** 示例以 Windows PowerShell 为主；跨平台差异会单独注明。

## 维护要求

修改可观察行为时，至少同步更新：

1. 对应源码与测试；
2. [配置参考](CONFIGURATION.md) 或 [架构](ARCHITECTURE.md)；
3. [验证范围](VALIDATION.md) 中的证据与未测项；
4. [CHANGELOG](../CHANGELOG.md)。

仅修改文档时，应核对命令、示例、相对链接与版本号，无需重复发送生成请求。
