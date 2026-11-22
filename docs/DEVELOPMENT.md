# 开发

## 环境与命令

使用 package.json engines 指定的 Node.js 版本，推荐本机已测的 24.22.1。SDK 精确固定为 2.3.2，TypeScript 5.9.3，Vitest 5.1.1。依赖通过 package-lock.json 锁定。

```powershell
npm ci
npm run check
npm test
npm run check:package
```

check 执行 TypeScript 严格检查，test 执行 Vitest，check:package 先构建再验证包导出可被 Node 加载。build 单独执行 `tsc -p tsconfig.build.json`，生成 dist。修改源码后先构建，再让宿主重新加载。

CI 在 Windows/Linux、Node 22/24 上运行安装、类型检查、测试和包入口检查。真实 localhost HTTP 测试需要允许本地网络。受限环境中的网络错误不能作为功能失败结论，也不能跳过测试后声称通过。

## 模拟宿主验证

```powershell
# opencode 不在 PATH 时，设为实际可执行文件路径
$env:OPENCODE_BIN = 'C:/path/to/opencode.exe'
npm run test:host
npm run test:host:inference
```

工具在工作区 `.host/smoke` 下使用独立配置和 XDG 目录，启动本地 HTTP 模拟网关及真实 OpenCode standalone 进程。test:host 检查本地包加载、目录鉴权和嵌套 ID；test:host:inference 增加模拟 SSE 回复及 wire model 字段检查。仅使用模拟密钥，结果保存在 `.host/smoke/result.txt`。

这些工具需要兼容的 OpenCode 可执行文件。Windows 超时会结束该次子进程树。它们不验证真实上游能力或持续运行的 TUI 选择器。

## 可选真实联调

```powershell
node tools/verify-live.mjs
# 或指定真实目录中的模型 ID
node tools/verify-live.mjs trae-cn/Doubao-Seed-2.1-Turbo
```

当前工具面向 Windows 本机部署：读取 `%USERPROFILE%/.config/opencode/opencode.json` 中本插件的 gatewayKey，连接正在运行的默认 OpenCode 服务。它比对远端与宿主全部模型 ID，随后发送一次真实生成请求，可能产生上游用量。默认模型为 trae-cn/Doubao-Seed-2.1-Turbo，必须存在于目录。

输出只记录模型对比与生成结果，密钥会脱敏；证据写入 docs/live-validation.json。该工具不覆盖仅环境变量凭据、自定义配置目录或所有模型，不应作为通用 CI 依赖。

## 修改约束

保持包版本、插件/provider ID 和 exports 稳定。core 不引入宿主依赖。可观察行为变化应更新测试、配置文档和 CHANGELOG。SDK 升级要重新检查实际声明，并验证真实加载、鉴权和推理。不要为消除类型报错引入 any 或整体忽略类型检查。
