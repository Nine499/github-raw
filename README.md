# GitHub Raw 代理服务

一个简单、高效的 GitHub 原始文件代理服务，支持缓存和速度限制。

## 🚀 功能特性

- ⚡ **速度限制**: 每秒最多 10 次请求，防止服务器过载
- 💾 **智能缓存**: 5 分钟内存缓存，提升响应速度
- 🔒 **安全验证**: 令牌验证和路径安全检查
- 🌐 **跨域支持**: 完整的 CORS 配置
- 📱 **极简架构**: 单文件实现，易于维护

## 📦 部署

### 环境变量

在 Vercel 控制台设置以下环境变量：

```bash
NINE49TOKEN=your_user_token_here        # 用户验证令牌（必需）
GITHUB49TOKEN=your_github_token_here    # GitHub API 令牌（可选）
```

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nine499/github-raw)

## 🛠️ 使用方法

### API 格式

```text
https://your-domain.com/owner/repo/branch/path/to/file?nine-token=YOUR_TOKEN
```

### 参数说明

- `owner`: GitHub 仓库所有者
- `repo`: 仓库名称
- `branch`: 分支名称
- `path/to/file`: 文件路径
- `nine-token`: 访问令牌

### 示例

```bash
# 获取文件内容
curl "https://your-domain.com/Nine499/github-raw/main/api/github-raw.js?nine-token=YOUR_TOKEN"

# 在 HTML 中使用
<img src="https://your-domain.com/owner/repo/main/images/logo.png?nine-token=YOUR_TOKEN">
```

## ⚙️ 配置

### 速度限制

- **限制**: 每秒 10 次请求
- **窗口**: 1 秒滑动窗口
- **超限处理**: 重定向到安全页面

### 缓存策略

- **缓存时间**: 5 分钟（300 秒）
- **最大条目**: 100 个文件
- **淘汰策略**: LRU（最近最少使用）

### 安全设置

- **令牌验证**: 严格匹配用户令牌
- **路径验证**: 防止目录遍历攻击
- **文件类型**: 支持文本、图片、应用等类型

## 📊 性能

- **缓存命中**: < 50ms 响应时间
- **缓存未命中**: < 1000ms 响应时间
- **内存使用**: 优化的内存管理
- **并发处理**: Vercel 自动扩缩容

## 🔧 开发

### 本地开发

```bash
# 克隆项目
git clone https://github.com/Nine499/github-raw.git
cd github-raw

# 安装 Vercel CLI
npm i -g vercel

# 设置环境变量
echo "NINE49TOKEN=your_token" > .env.local

# 启动开发服务器
vercel dev
```

### 项目结构

```text
github-raw/
├── api/
│   └── github-raw.js          # 主服务文件
├── package.json               # 项目配置
├── vercel.json                # Vercel 配置
├── README.md                  # 项目文档
└── IFLOW.md                   # 详细文档
```

## 🛡️ 安全

- **输入验证**: 严格的参数和路径验证
- **令牌保护**: 防止未授权访问
- **错误处理**: 统一的错误处理，不暴露敏感信息
- **跨域控制**: 可配置的 CORS 策略

## 📝 更新日志

### v2.2.0

- ✨ 新增速度限制功能
- 🚀 简化项目结构为单文件
- 💾 优化缓存性能
- 🔧 提升代码可维护性

### v2.1.0

- ✨ 智能缓存机制
- 📊 缓存统计和监控
- 🔧 优化的错误处理

### v2.0.0

- 🎉 完全重构为模块化架构
- ✨ 增强的安全性和验证
- 📊 完善的日志系统

### v1.0.0

- 🎯 基础功能实现
- 🔑 令牌验证
- 📁 GitHub 文件代理

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请创建 Issue 或联系维护者。
