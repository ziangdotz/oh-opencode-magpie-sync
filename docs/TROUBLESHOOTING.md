# 故障排查

| 症状 | 处理 |
| --- | --- |
| 找不到 Magpie Gateway | 用 opencode debug paths 确认服务端配置，检查 plugins 包路径、dist/index.js 和服务是否已重启 |
| 模型列表为空 | 检查网关可达性、Gateway Key 及发现日志；重启后离线启动不会恢复旧进程目录 |
| 401 / 403 | 检查 Magpie Gateway Key 和权限；JSON 非空 gatewayKey 优先于环境变量 |
| 新 shell 设置密钥无效 | 已运行服务不会继承新变量；配置服务进程环境，或使用 JSON 后重启服务 |
| Magpie provider collision | 移除重复的 magpie provider 配置或竞争插件，保留一个注册来源 |
| 模型列表仍是旧目录 | 等待刷新周期，核对 Catalog synced 日志，再重新打开 /models；服务端 reload 不等于 TUI 已刷新 |
| 分组名未显示 | 检查 Magpie 是否返回 magpie_label，重新构建插件并重启服务；缺失时使用其他名称字段 |
| 选中模型但推理失败 | 核对该模型权限及上游健康状态；v0.1.0 仅使用 OpenAI-compatible Chat，不按 native_endpoints 切换协议 |
| 工具或图片不可用 | 当前仅声明文本输入输出，工具关闭；远端支持不代表插件已映射 |
| 超时或目录异常 | 检查默认 5 秒发现超时、8 MiB 响应上限、JSON 结构及重复 ID；已有有效目录应保留 |
| Node 加载不到包 | 执行 npm ci 和 npm run check:package，确认配置指向实际包目录 |

发现日志使用通用错误，不保证直接显示 HTTP 状态。需要定位 401 或数据错误时，在本机用受控方式检查网关，不要输出完整响应体、配置或鉴权头。

报告问题时提供插件/OpenCode/Node 版本、操作步骤、脱敏错误、Base URL 路径结构及具体模型 ID。不要附 Gateway Key、服务密码、完整用户配置或数据库。SDK 限制值为 0 的模型需另行确认输出/压缩行为，详见 [验证范围](VALIDATION.md)。
