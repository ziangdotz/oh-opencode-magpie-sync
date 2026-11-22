# opencode-magpie-sync

**v0.1.0** · OpenCode **2.3.2** · Server plugin

将远端 Magpie 模型目录同步到 OpenCode 原生 `/models`。Windows OpenCode 可通过以太网连接 Linux Magpie，无需在 Windows 安装 Magpie 或手动维护模型 ID。

[English](README.en.md)

## 安装

已验证 OpenCode 2.3.2、Windows、Node.js 24.22.1。开发工具支持 Node.js 22.12、24 及 26+ 系列，精确范围见 package.json。SDK 固定为 2.3.2，升级宿主前应重新验证兼容性。

在项目目录执行：

```powershell
npm ci
npm run check:package
```

通过 `opencode debug paths` 确认服务端配置目录，将本项目的实际绝对路径加入 `opencode.json` 的 `plugins`，与已有配置合并：

```json
{
  "plugins": [
    {
      "package": "file:///C:/plugins/opencode-magpie-sync",
      "options": {
        "baseURL": "http://192.168.22.100:3425/v1",
        "gatewayKey": "REPLACE_WITH_MAGPIE_GATEWAY_KEY",
        "refreshSeconds": 30,
        "timeoutMs": 5000
      }
    }
  ]
}
```

替换包路径和 Gateway Key。入口为编译后的 `dist/index.js`，修改源码或更新本地包后需要重新构建。本插件只有 Server 入口，配置在 `opencode.json`，无需向 `cli.json` 添加 TUI 插件。

使用后台服务时执行 `opencode service restart`；使用 `--standalone` 时退出并重新启动该进程。安装 `.tgz` 时先将其安装到持久目录，再将配置指向安装后的包目录。当前尚未发布到 npm 公共仓库。

## 快速开始

1. 在 Linux Magpie 开启可从 Windows 访问的网关，确认 TCP 3425 可达。
2. 在插件 options 填写网关 Base URL 和 Magpie Gateway Key，保存并重启 OpenCode 服务。
3. 输入 `/models`，在 **Magpie Gateway** 下选择模型，发送测试消息。

模型显示完整 Magpie 标签，例如 `Seed-2.1-Turbo · Trae CN`。选择 ID 为 `magpie/trae-cn/Doubao-Seed-2.1-Turbo`，推理请求中的模型 ID 保留为 `trae-cn/Doubao-Seed-2.1-Turbo`。

密钥也可通过服务进程的 `MAGPIE_GATEWAY_KEY` 环境变量提供。非空 `options.gatewayKey` 优先；两种方式同时覆盖目录发现和推理鉴权。JSON 中的密钥以明文保存，只放在本机用户配置中。详见[配置](docs/CONFIGURATION.md)。

## 功能范围

- 单一 `magpie` provider，自动发现模型及同步完整显示标签。
- 默认每 30 秒刷新；列表顺序变化不触发 registry reload。
- 发现失败保留最近一次有效目录，恢复连接后继续同步。
- 连续两次有效空目录才清空；失败会打断空目录计数。
- 发现和推理均发送 Bearer 鉴权，保留代理路径并禁止重定向。
- 使用 OpenAI-compatible Chat 路径，仅声明文本输入输出，工具关闭。

本机已验证真实 Linux Magpie 的 96 个模型与 OpenCode 列表一致，并完成一次真实文本生成。运行中增删模型后的 TUI 自动刷新、真实断网恢复、工具及其他协议仍见[验证范围](docs/VALIDATION.md)。

## 项目文档

- [运行与交付规范](docs/OPERATIONS.md)
- [架构](docs/ARCHITECTURE.md)
- [配置](docs/CONFIGURATION.md)
- [开发及测试](docs/DEVELOPMENT.md)
- [故障排查](docs/TROUBLESHOOTING.md)
- [发布流程](docs/RELEASING.md)
- [验证范围](docs/VALIDATION.md)
- [依赖审查](docs/DEPENDENCY-REVIEW.md)
- [版本记录](CHANGELOG.md) · [贡献规范](CONTRIBUTING.md) · [安全说明](SECURITY.md)

```powershell
npm run check
npm test
npm run check:package
```

版本保持 0.1.0，后续版本变更由维护者明确决定。
