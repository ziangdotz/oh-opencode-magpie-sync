# 兼容性策略

本插件依赖 OpenCode 的服务端插件 API。插件 API 仍在演进，因此版本策略以**目标宿主精确匹配**为原则，而不是声明宽泛的 semver 兼容范围。

## 1. 当前基线

| 项目 | 值 |
| --- | --- |
| 目标宿主 | OpenCode **2.4.1** |
| 构建/类型 SDK | `@opencode/plugin` **2.4.1**（精确版本） |
| 传递 SDK | `@opencode/ai`、`@opencode/schema`、`@opencode/client`、`@opencode/protocol`、`@opencode/util` 均为 2.4.1 |
| Node.js | `^22.12.0 || ^24.0.0 || >=26`；实测 24.22.1 |
| 插件版本 | v0.1.0 |
| 包形态 | 私有包，通过本地目录加载，未发布 npm |

SDK 在 `package.json` 中**不带** `^` 或 `~`；`package-lock.json` 固定完整安装树。不要用 `npm update` 或未审查的 `npm audit fix --force` 改写 SDK 契约。

## 2. 兼容范围声明

| 宿主版本 | 状态 | 说明 |
| --- | --- | --- |
| OpenCode 2.4.1 | **已验证适配** | 类型、18 项测试、包入口、真实宿主 + 模拟目录通过；零推理请求 |
| OpenCode 2.4.0 | 曾验证 | 上一轮适配基线；API 与本版几乎一致（2.4.1 增加 `automation` 域） |
| OpenCode 2.3.2 | 历史验证 | 曾有真实 Linux Magpie 96 模型与一次文本生成记录；不作为 2.4.x 依据 |
| 其他 2.x / 3.x | **未承诺** | 需按第 4 节重新适配与验收 |

“已验证适配”仅覆盖文档所列检查，不等于所有模型、协议与网络场景可用。

## 3. 使用的 API 面

插件只使用以下公开 API。升级宿主时应优先核对这些契约是否变化：

| API | 用途 | 位置 |
| --- | --- | --- |
| `Plugin.define({ id, setup })` | 定义服务端插件与卸载回调 | `src/server/plugin.ts` |
| `ctx.options` | 读取 `plugins[].options` | `src/server/plugin.ts` |
| `ctx.provider.transform(editor)` | 注册 provider 与模型快照 | `src/server/plugin.ts` |
| `editor.get / add` | 冲突检测与注册 | `src/server/plugin.ts` |
| `ctx.provider.reload()` | 提交目录变化 | `src/server/plugin.ts` |
| `ctx.session.hook("http.request", cb, { providerID })` | 推理请求鉴权与目标校验 | `src/server/plugin.ts` |
| `Registration.dispose()` | 卸载钩子与 transform | `src/server/plugin.ts` |
| `Provider.ID.make` / `Provider.Info.empty` | provider 标识与默认结构 | `src/server/plugin.ts` |
| `Model.ID.make` / `Model.Info.default` | 模型标识与默认结构 | `src/server/plugin.ts` |

关键行为假设：

1. `provider.transform` 在每次 `reload()` 时重新执行，并读取插件持有的最新数组。
2. `http.request` 钩子在驱动构造最终请求之后、发送之前执行，替换 `event.request` 会影响实际发出的请求。
3. 钩子的第三个参数 `{ providerID }` 能正确限定作用域。
4. `reload()` 失败时抛错，且不会部分提交新目录。

任一假设变化都可能需要代码调整，而不是只改版本号。

## 4. 宿主升级流程

### 4.1 准备

1. 记录当前宿主版本、插件版本、锁文件哈希与配置备份（配置可能含密钥，只存受控目录）。
2. 在候选目录安装目标 SDK 精确版本：

   ```powershell
   npm install --save-exact @opencode/plugin@<target>
   ```

3. 阅读宿主变更日志与 SDK 的 `dist/promise/*.d.ts`，核对第 3 节 API。

### 4.2 静态与自动检查

```powershell
npm run check
npm test
npm run check:package
```

类型错误不得用 `any`、`@ts-ignore` 或放宽 `strict` 消除；应先确认 SDK 契约变化。

### 4.3 宿主冒烟（零推理）

```powershell
npm run test:host
```

该命令使用真实 `opencode` 与 localhost 模拟目录，验证：

- 本地包可被宿主加载；
- `plugins[].options` 与 `baseURL` 生效；
- 发现请求携带正确 Bearer；
- 嵌套模型 ID 出现在 `opencode models`；
- 明确报告零推理请求。

通过后仍不能声称推理可用。

### 4.4 人工验收

按 [部署与验收](DEPLOYMENT.md) 在目标环境重启服务并检查 `/models`。模型生成由部署方按自身网关单独验证，不属于仓库默认验收。

### 4.5 记录

在 [CHANGELOG](../CHANGELOG.md) 与 [验证范围](VALIDATION.md) 中记录：

- 原/新宿主与 SDK 版本；
- 执行的命令与结果；
- 未覆盖项；
- 是否需要配置迁移。

## 5. 回滚

1. 恢复旧版 `package.json`、`package-lock.json` 与已构建的 `dist/`（或旧包目录）。
2. 执行 `npm ci` 与 `npm run check:package`。
3. 将配置指回旧包路径，重启服务。
4. 用 `opencode models` 确认 `magpie/*` 条目恢复。

不要通过删除宿主数据库、其他 provider 凭据或用户配置来“修复”兼容问题。

## 6. Node.js 版本

- 构建与测试支持 `^22.12.0`、`^24.0.0`、`>=26`。
- 宿主运行时不要求系统 Node.js 与构建版本一致；OpenCode 发行版自带运行时。
- CI 矩阵覆盖 Node 22/24/26 与 Windows/Linux，但仓库目前没有远端 Actions 通过记录，不能把“已配置”当作“已通过”。

## 7. 版本与发布策略

- 插件版本严格固定为 **v0.1.0**，与宿主版本独立。
- 本次 OpenCode 2.4.1 适配**不改变插件版本**；相关改动记录在 [CHANGELOG](../CHANGELOG.md) 的“未发布”小节。
- 任何版本变更必须由维护者明确授权；未经授权不得提升 patch、minor 或 major。
- 不承诺跨 minor 的 API 兼容；升级宿主视为一次受控变更。
