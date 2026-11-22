# 运行与交付规范

当前基线：插件 0.1.0、OpenCode / SDK 2.3.2，本机 Windows / Node.js 24.22.1。插件编译为 JavaScript 后加载，服务端使用远端 Linux Magpie，不依赖 Windows Magpie 进程。

## 日常运行

通过 `opencode debug paths` 确认配置目录。在 opencode.json 配置包绝对路径、Base URL 和凭据，构建完成后重启服务：

```powershell
opencode service restart
opencode service status
opencode models
```

standalone 进程需要单独重启。不要同时加载其他注册 magpie provider 的插件。默认模型不由本插件修改，用户在 `/models` 中选择。

## 更新与恢复

升级前备份用户配置和当前安装目录或安装包。JSON 配置可能含明文 Gateway Key，备份只保存在受控本地目录。先在候选目录安装依赖、完成检查和构建，再更新插件路径并重启服务。

轮询失败保留最近一次有效内存目录，不需要重复配置或新增 provider。网络和鉴权恢复后自动重试。配置选项变更需要重启服务；重启会丢失内存快照，离线时无法恢复上一进程的目录。

回滚时恢复旧包路径及匹配配置，然后重启服务。切回 Ollama 时移除本插件条目，在 `/models` 选择已配置的 `ollama/<model>`，保留现有 `providers.ollama` 和其他 provider 配置。不要为排障删除 OpenCode 数据库或其他凭据。

## 交付检查

执行类型检查、自动测试、构建包入口检查和目标宿主回归，见 [发布流程](RELEASING.md)。CI 已配置不等于远端运行通过。真实 Linux 联调工具会发送一次真实模型请求，模拟工具与日常配置的使用方式见 [开发](DEVELOPMENT.md)。

发布说明应列明宿主和 Node 版本、实测项目、未完成项目及依赖审查。一次模型生成成功不等于所有模型、协议或工具均可用。
