# 发布流程

当前基线 v0.1.0，package.json 与 package-lock.json 均保持 0.1.0。版本只在维护者明确要求时更新；当前 package.json 设置 private=true，不能直接 npm publish。

1. 核对配置、用户文档、CHANGELOG 和验证范围，保留真实与模拟测试的区别。
2. 从干净目录执行 npm ci、npm run check、npm test、npm run check:package。
3. 执行 npm run test:host 和 npm run test:host:inference，记录宿主版本。需要时进行单独授权的真实 Linux 联调。
4. 执行 npm audit --json，审查传递依赖及可达范围。不要通过无审查的强制升级改写 SDK 契约。
5. 执行 npm pack --dry-run 核对文件，再执行 npm pack 生成候选包，记录 SHA-256。prepack 仅自动 build，不自动执行全部测试。
6. 将候选包安装到持久测试目录，用目标 OpenCode 加载该目录复验。包导出检查和工作区加载不能替代独立安装验证。
7. 按明确授权的发布目标交付；不自动发布 npm、推送代码或创建标签。

```powershell
npm pack
Get-FileHash -LiteralPath ./opencode-magpie-sync-0.1.0.tgz -Algorithm SHA256
```

包 files 白名单包含 dist、src、docs、tools、配置示例、README、英文 README、贡献/安全说明、CHANGELOG 和许可证。测试源码、CI、node_modules、.host、本机密钥和用户配置不在白名单中。候选包含部分验证工具，但运行这些工具仍需对应开发依赖及宿主。

lockfile 用于仓库的可重复开发安装；npm 通常不将 package-lock.json 放入发布 tarball，不能承诺使用方安装树与仓库 npm ci 完全相同。当前真实 TUI 增删传播及其他待测项目见 VALIDATION.md，交付时应明确写出。
