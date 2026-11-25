# 发布流程

本文定义版本、制品、门禁与交付记录。当前包为 `private: true`，**不能**直接 `npm publish`；发布不等于推送代码或创建标签，所有对外动作需维护者明确授权。

> **版本约束：** 插件版本严格固定为 **v0.1.0**。未经维护者明确指示，不得修改 `package.json` / `package-lock.json` 的 `version`，也不得在文档、制品名或发布说明中声称其他版本。

## 1. 版本策略

当前插件版本：**v0.1.0（严格固定）**。`package.json` 中使用 semver 形式 `0.1.0`，文档与展示写作 `v0.1.0`，二者指同一固定版本。

- 宿主适配、缺陷修复、文档与测试完善默认记录在 [CHANGELOG](../CHANGELOG.md) 的“未发布”小节，**不改变版本号**。
- 不得自行提升 patch、minor 或 major，也不得用日期、构建号或宿主版本替代插件版本。
- 只有维护者明确发起版本变更时，才允许同步修改：
  - `package.json` 与 `package-lock.json`；
  - `README.md` / `README.en.md` 的版本标识；
  - [CHANGELOG](../CHANGELOG.md)；
  - 本文与 [验证范围](VALIDATION.md) 中的基线。
- 版本变更必须一次提交内保持一致，禁止只改其中一处。
- `npm pack` 生成的制品文件名使用 semver 形式（`opencode-magpie-sync-0.1.0.tgz`），与展示版本 `v0.1.0` 对应，不构成版本变更。
- 插件版本独立于 OpenCode 版本；发布说明必须写明目标宿主与 SDK。

## 2. 发布前门禁

按顺序执行，任一失败即停止：

```powershell
npm ci
npm run check
npm test
npm run check:package
npm run test:host
npm audit --json
npm pack --dry-run
```

| 门禁 | 通过条件 |
| --- | --- |
| 安装 | `npm ci` 成功，锁文件未漂移 |
| 类型 | 无错误，未放宽 `strict` |
| 单元测试 | 全部通过（当前 18/18） |
| 包入口 | `Built package export loaded` |
| 宿主冒烟 | 真实目标宿主加载、嵌套 ID、零推理请求 |
| 审计 | 记录 high/critical 数量与可达性；不得隐瞒 |
| 打包 | 清单只包含预期文件 |

可选门禁（需单独授权）：

- `npm run test:host:inference`：模拟推理；
- `node tools/verify-live.mjs`：真实网关 + 一次生成。

真实生成会产生上游用量，且不能证明全部模型可用。

## 3. 变更审查

发布前确认：

- [ ] 行为变化有测试与文档；
- [ ] 配置兼容性已评估（新增字段有默认值）；
- [ ] 稳定标识未无意变更（插件 ID、provider ID、包名、exports）；
- [ ] 密钥、`.host/`、`node_modules/`、`dist/`、日志、`.tgz` 未进入提交；
- [ ] 历史证据未被表述为当前结论；
- [ ] 依赖变化已审查，未使用 `npm audit fix --force` 覆盖 SDK。

## 4. 制品

```powershell
npm pack
Get-FileHash -LiteralPath ./opencode-magpie-sync-0.1.0.tgz -Algorithm SHA256
```

记录：

- 文件名、大小、SHA-256；
- 构建时间、构建人；
- 插件/宿主/SDK/Node 版本；
- 执行的检查与结果；
- 未覆盖项。

`files` 白名单包含 `dist`、`src`、`docs`、示例、README、贡献/安全说明、`tools`、CHANGELOG 与 LICENSE。测试源码、CI、`node_modules`、`.host`、本机密钥与用户配置不在包内。

`prepack` 只执行 build，不执行完整测试；不要用 `npm pack` 代替门禁。

## 5. 独立安装验证

工作区加载不能替代独立安装。发布候选至少执行一次：

1. 将 `.tgz` 安装到持久测试目录；
2. 用目标 OpenCode 指向该目录加载；
3. 执行 [部署与验收](DEPLOYMENT.md) 第 6 节；
4. 记录结果与宿主版本。

`package-lock.json` 通常不进入 npm tarball；使用方安装树不保证与仓库 `npm ci` 完全一致，发布说明应说明这一点。

## 6. 发布说明模板

```markdown
## <version> · <date>

### 兼容性
- OpenCode: <version>
- @opencode/plugin: <version>
- Node.js: <range / tested version>

### 变更
- <行为变化>

### 验证
- 类型检查：通过/失败
- 单元测试：N/N
- 包入口：通过/失败
- 宿主冒烟：通过/失败（零推理/含模拟推理）
- 真实联调：未执行/已执行（模型、结果）

### 已知限制
- <未验证项>

### 升级/回滚
- <配置或包路径变化>
```

## 7. 发布后

- 归档制品与 SHA-256；
- 保留回滚版本与匹配锁文件；
- 监控首批部署的加载、发现与日志；
- 若发现回归，按 [部署与验收](DEPLOYMENT.md) 回滚，并记录原因；
- 不在发布后静默改写依赖或重建同名制品。

## 8. 禁止事项

- 未经授权 `npm publish`、推送代码、创建标签或发布 Release；
- 在 `private: true` 下声称已发布 npm 包；
- 使用未审查的强制升级修复审计；
- 在发布说明中把模拟测试写成真实联调；
- 附带真实密钥、用户配置或数据库。
