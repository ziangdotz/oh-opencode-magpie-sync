# 依赖审查

本文记录依赖树、审计结果、传递依赖可达性与处置原则。审计结果是**时间点快照**，不是安全认证或零漏洞承诺。

## 1. 当前快照

| 项目 | 值 |
| --- | --- |
| 日期 | 2026-11-26 |
| 插件 | v0.1.0 |
| 直接运行时依赖 | `@opencode/plugin` **2.4.2**（精确版本） |
| 传递 SDK | `@opencode/ai`、`@opencode/schema`、`@opencode/client`、`@opencode/protocol`、`@opencode/util` 均为 2.4.2 |
| 开发依赖 | `@types/node` 24.10.1、`typescript` 5.9.3、`vitest` 5.1.1 |
| 完整审计 | **24 moderate / 0 high / 0 critical** |
| 生产审计（`--omit=dev`） | 本轮未单独重复；历史结果为 24 moderate |

本轮完整审计：24 moderate、0 high、0 critical；SDK 传递依赖为 2.4.2，Effect 为 4.1.0。原始报告：[audit.json](audit.json)。生产审计尚未在本轮单独重复，旧记录仅作历史参考。

## 2. 审计命令

```powershell
npm audit --json
npm audit --omit=dev --json
```

历史完整审计与生产审计结果相同；本轮只重复完整审计，不能将其记为生产专用审计已运行。

## 3. 告警来源

当前 24 项均为 **moderate**，无 high/critical。主要链路：

```text
@opencode/plugin@2.4.2
├── @opencode/util@2.4.2
│   ├── @npmcli/arborist
│   ├── pacote → sigstore → @sigstore/tuf → tuf-js → @tufjs/models
│   ├── glob → minimatch
│   └── cacache / npm-registry-fetch / npm-packlist / ignore-walk
└── @opencode/ai@2.4.2
    └── google-auth-library → gcp-metadata → gaxios → rimraf → glob → minimatch
```

这些包多为 npm/registry/签名与文件遍历工具，由 OpenCode SDK 的传递依赖引入，不是本插件直接调用。

## 4. 可达性评估

| 问题 | 评估 |
| --- | --- |
| 是否由本插件代码直接调用？ | 否。插件只使用 `Plugin.define`、provider/model 注册、`http.request` 钩子 |
| 是否进入宿主运行时？ | 宿主使用自身打包的 SDK 运行时；本地安装树主要用于构建与类型检查 |
| 是否处理不可信输入？ | 主要风险包用于包管理/签名/路径匹配，不在插件的发现或推理热路径 |
| 是否有自动修复？ | 多数 `fixAvailable: false`；个别可通过升级上层依赖解决，但当前无兼容版本 |
| 是否可删除？ | 删除会破坏构建或 SDK 类型契约，不可行 |

结论：当前未发现 high/critical，也未发现插件代码直接触发这些告警的路径；但**不能**据此宣称生产环境零风险。商业部署应按自身威胁模型、宿主打包方式和实际安装树评估。

## 5. 处置原则

1. **不执行** `npm audit fix --force`。强制覆盖可能改变 SDK 契约或引入未验证版本。
2. **优先上游修复**：等待 `@opencode/plugin` / `@opencode/util` 更新，再按 [兼容性策略](COMPATIBILITY.md) 全量验证。
3. **精确锁定**：保持 `package.json` 无 `^`/`~`，由 `package-lock.json` 固定树。
4. **记录变化**：升级 SDK、测试工具或覆盖传递版本后，重新运行 `npm run verify`、`npm run test:host` 与审计。
5. **区分环境**：构建机、CI、宿主运行时的依赖树可能不同；不要用本地审计结果替代宿主的软件物料清单。
6. **保留证据**：归档不含凭据的 `npm audit --json` 输出；不要附用户配置或数据库。

## 6. 供应链边界

- 插件不下载模型、不执行远程代码、不上传遥测。
- 插件只访问配置的 Magpie 网关；不访问 npm、GitHub 或其他外部服务。
- 宿主与 SDK 的供应链安全由 OpenCode 发行方与部署方共同负责。
- 本仓库未提供 SBOM、签名制品或独立安全审计；需要时应由部署方另行生成/委托。

## 7. 复现与更新

```powershell
npm ci
npm audit --json
npm audit --omit=dev --json
npm run verify
npm run test:host
```

若审计数量变化：

1. 记录新增/减少的包与严重级别；
2. 判断是否进入插件热路径；
3. 评估上游是否已有兼容修复；
4. 在候选环境验证后更新锁文件；
5. 同步更新本文与 [CHANGELOG](../CHANGELOG.md)。
