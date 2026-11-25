# 贡献规范

共同分层、开发流程、文档职责与验证授权见 [统一工程规范](docs/ENGINEERING.md)。项目专属规则见本文。

感谢参与。提交前请阅读 [架构](docs/ARCHITECTURE.md)、[开发指南](docs/DEVELOPMENT.md) 与 [兼容性策略](docs/COMPATIBILITY.md)。

## 1. 变更原则

- **小步、可审查**：一次提交解决一个明确问题，避免混合重构与行为变更。
- **契约优先**：保持插件 ID `magpie.sync`、provider ID `magpie`、包名、`exports` 与模型 wire ID 稳定。
- **证据分级**：自动测试、宿主模拟、真实联调、未验证四种状态不得混写。
- **安全默认**：不新增未声明的网络访问；不在日志/错误中输出密钥或完整响应。
- **默认无生成**：仓库验收不发送真实模型生成请求；需要时单独授权并在说明中标注。

## 2. 提交前检查

```powershell
npm ci
npm run check
npm test
npm run check:package
npm run test:host
```

涉及 SDK、鉴权、provider 注册或刷新逻辑时，`npm run test:host` 为必需项。仅修改文档时，可只核对命令、示例、相对链接与版本号。

仅在用户明确授权模型调用测试后执行（包括模拟生成）：

```powershell
npm run test:host:inference   # 模拟 SSE 推理
node tools/verify-live.mjs    # 真实网关 + 一次真实生成
```

真实联调需维护者授权，并记录模型、时间与脱敏结果。

## 3. 变更同步要求

| 变更类型 | 必须同步 |
| --- | --- |
| 可观察行为 | 测试、配置文档、CHANGELOG |
| 新增/修改选项 | `readOptions`、边界测试、配置文档、示例 |
| 目录字段映射 | `catalog.ts`、`toModel`、签名、解析测试、验证范围 |
| 宿主/SDK 升级 | 锁文件、兼容性策略、验证范围、CHANGELOG |
| 发布/版本 | `package.json`、锁文件、README、CHANGELOG、发布说明；版本变更仅限维护者明确授权 |

## 4. 代码约束

- 不引入 `any`、`@ts-ignore` 或放宽 `strict` 来消除类型错误。
- 插件版本严格固定为 **v0.1.0**；未经维护者明确授权，不得修改 `package.json` / `package-lock.json` 的 `version`。
- `core` 不导入 `@opencode/plugin`，保持纯 Node 可测。
- 不改变“发现失败保留旧目录”“连续两次有效空响应才清空”“reload 失败回滚”的语义，除非有明确设计与测试。
- 不把密钥写入测试夹具、快照、日志或错误。
- 新增依赖需说明用途、版本策略与审计影响。

## 5. 文档规范

- 使用简体中文作为深度文档主语言；英文 README 与中文 README 的关键事实保持一致。
- 命令以 Windows PowerShell 为主，跨平台差异单独注明。
- 示例使用占位符，不出现真实主机密钥。
- 版本号、测试数量、宿主版本必须与仓库当前状态一致。
- 不把历史联调写成当前结论。

## 6. 禁止提交

- Gateway Key、服务密码、令牌、私钥；
- 个人 `opencode.json`、数据库、`.host/`；
- `node_modules/`、`dist/`、`*.tgz`、日志、覆盖率产物；
- 未脱敏的响应体、请求头或截图。

## 7. 提交说明

建议包含：

1. 问题与背景；
2. 最终行为（而非仅实现细节）；
3. 验证命令与结果；
4. 兼容性影响；
5. 未覆盖项/后续工作。

## 8. 许可

提交即表示同意以本仓库的 [MIT 许可证](LICENSE) 授权该贡献。请勿提交来源不明或授权不兼容的代码。
