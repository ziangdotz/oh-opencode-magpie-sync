# 架构

## 包边界

```text
src/
  index.ts                 服务端稳定导出
  core/
    catalog.ts             目录结构校验、显示标签和稳定签名
    gateway.ts             路径保留、有界响应和超时发现请求
  server/
    plugin.ts              选项、Provider/Model 注册、鉴权及轮询生命周期
```

core 不依赖 OpenCode。server 依赖固定版本 SDK，将远端快照转为原生 Provider/Model。入口编译为 dist/index.js，包 exports 指向该文件。tests 覆盖纯逻辑和生命周期，tools 提供包入口、真实宿主模拟及可选 Linux 联调。

## 数据流

Magpie `/models` → HTTP/JSON 校验 → 排序和签名 → 内存快照 → `ctx.provider.reload()` → 原生模型注册表。transform 在 reload 时读取当前快照。reload 失败恢复旧快照并允许后续轮询重试。

推理由 OpenCode 的 `@opencode/ai/providers/openai-compatible` driver 执行。正式 `http.request` 钩子限定 provider、目标 origin 和路径后设置 Bearer 头，并将请求设为拒绝重定向。SDK 2.3.2 的 Provider.Info 不包含 env 字段，不能依赖该字段完成凭据传递。

## 生命周期

setup 注册 provider transform 和鉴权钩子，执行首次发现，再启动定时器。首次发现失败不阻止宿主启动。一个 pending Promise 合并重叠刷新；停止后不再接纳新刷新，进行中的发现不提交快照。

卸载清除定时器，等待当前有界发现请求结束，释放鉴权和 provider 注册。没有数据库或磁盘目录缓存。JSON 密钥在 setup 读取，改动后需要重启；环境变量在每次请求时读取。

## 稳定标识

包名 `opencode-magpie-sync`，插件 ID `magpie.sync`，provider ID `magpie`，显示名 `Magpie Gateway`，版本 0.1.0。模型完整 ID 原样透传，包括多级斜杠。检测到已有 magpie provider 时拒绝注册，避免覆盖其他来源。

服务端 registry reload 与 TUI 缓存传播是两个环节；本插件没有独立 TUI、RPC、手动刷新命令或多个 provider 分组。宿主升级后须重新验证注册、鉴权、推理和选择器传播。
