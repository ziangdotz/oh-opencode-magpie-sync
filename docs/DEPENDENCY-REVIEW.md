# 依赖审查

记录日期：2026-11-22，插件 0.1.0。依据固定 lockfile 的在线 `npm audit --json`，原始报告见 [audit.json](audit.json)。这是当时快照，漏洞库更新后应重新检查。

测试依赖 Vitest 已升级至精确版本 5.1.1，升级后审计为 **24 moderate、0 high、0 critical**。类型检查、15 项测试及包入口验证通过。离线安装输出的“0 vulnerabilities”不作为在线审计结论。

`@opencode/plugin` 2.3.2 当前属于 dependencies，SDK 的传递依赖进入安装树；不能套用其他项目“SDK 仅开发依赖、生产审计为零”的结论。当前报告包含全部依赖，尚未提供单独的生产可达性审查或生产零告警结论。

```powershell
npm audit --json
npm audit --omit=dev --json
```

升级 SDK、测试工具或覆盖传递版本后，重新执行工程检查与宿主回归。未审查的 `npm audit fix --force` 可能破坏宿主契约。保留不含凭据的审计证据，不向报告附加用户配置；本项目不宣称独立安全审计或生产认证。
