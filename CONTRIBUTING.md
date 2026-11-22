# 贡献规范

先阅读 [架构](docs/ARCHITECTURE.md)和[开发](docs/DEVELOPMENT.md)。提交说明应写清具体问题、最终行为、验证方式与兼容影响。保持现有 TypeScript 风格，行为变化同步更新测试、用户文档和 CHANGELOG。

提交前运行 npm run check、npm test、npm run check:package。涉及 SDK、鉴权或模型注册时增加真实宿主模拟回归，真实 Linux 请求单独记录。仅修改文档时核对命令、示例、相对链接与已测范围，无需重复发送真实生成请求。

不提交 Gateway Key、服务密码、个人用户配置、数据库、node_modules、.host 或生成的 tgz。公开插件/provider 标识及模型 wire ID 应保持稳定。版本保持 0.1.0，变更版本须经维护者明确指示。交付流程见 [发布流程](docs/RELEASING.md)。
