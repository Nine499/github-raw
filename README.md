# GitHub Raw 代理服务

> 🚀 一个简单、高效、安全的 GitHub 原始文件代理服务，专为加速访问而设计

[![Version](https://img.shields.io/badge/version-2026.01.16.165956-blue)](https://github.com/Nine499/github-raw)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nine499/github-raw)

---

## ✨ 功能特性

✅ **速度限制** - 每秒最多 10 次请求，防止服务器过载  
✅ **智能缓存** - 5 分钟内存缓存，缓存命中响应时间 < 50ms  
✅ **安全验证** - 令牌验证 + 路径安全检查，防止恶意访问  
✅ **跨域支持** - 完整的 CORS 配置，支持跨域访问  
✅ **极简架构** - 单文件实现，代码清晰易懂，易于维护  
✅ **自动扩缩容** - 基于 Vercel Serverless，自动处理并发  

---

## 📦 快速开始

### 1. 一键部署到 Vercel

点击下方按钮，一键部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nine499/github-raw)

### 2. 配置环境变量

在 Vercel 控制台设置以下环境变量：

```bash
NINE49TOKEN=your_user_token_here        # 用户验证令牌（必需）
GITHUB49TOKEN=your_github_token_here    # GitHub API 令牌（可选，用于提高访问速度）
```

### 3. 开始使用

部署完成后，即可通过以下格式访问文件：

```bash
https://your-domain.com/owner/repo/branch/path/to/file?nine-token=YOUR_TOKEN
```

**示例：**

```bash
# 获取 README 文件
curl "https://your-domain.com/Nine499/github-raw/master/README.md?nine-token=YOUR_TOKEN"

# 在 HTML 中引用图片
<img src="https://your-domain.com/owner/repo/main/images/logo.png?nine-token=YOUR_TOKEN">

# 在 JavaScript 中加载脚本
<script src="https://your-domain.com/owner/repo/main/script.js?nine-token=YOUR_TOKEN"></script>
```

---

## 🛠️ 本地开发

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/Nine499/github-raw.git
cd github-raw

# 2. 安装依赖
npm install

# 3. 设置环境变量
echo "NINE49TOKEN=your_token" > .env.local

# 4. 安装 Vercel CLI（如果未安装）
npm i -g vercel

# 5. 启动开发服务器
vercel dev
```

开发服务器将在 `http://localhost:3000` 启动。

---

## 📖 API 文档

### 请求格式

```
GET /owner/repo/branch/path/to/file?nine-token=YOUR_TOKEN
```

### 路径参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `owner` | GitHub 仓库所有者 | `Nine499` |
| `repo` | 仓库名称 | `github-raw` |
| `branch` | 分支名称 | `master`、`main`、`develop` |
| `path/to/file` | 文件路径 | `README.md`、`src/index.js`、`images/logo.png` |

### 查询参数

| 参数 | 必需 | 说明 |
|------|------|------|
| `nine-token` | 是 | 访问令牌，需要在环境变量中配置 |

### 响应

**成功（200）：**

```http
HTTP/1.1 200 OK
Content-Type: text/plain
X-Cache: HIT
Cache-Control: public, max-age=300
Access-Control-Allow-Origin: *

[文件内容]
```

**失败（302 重定向）：**

验证失败时，将重定向到安全页面（默认：百度）。

---

## ⚙️ 配置参数

### 速度限制

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_REQUESTS_PER_SECOND` | 10 | 每秒最多允许的请求数 |
| `windowMs` | 1000 | 时间窗口（毫秒） |
| 超限处理 | 重定向 | 超限时重定向到安全页面 |

### 缓存策略

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CACHE_TTL` | 300 | 缓存存活时间（秒），5 分钟 |
| `CACHE_MAX_SIZE` | 100 | 最多缓存文件数量 |
| 淘汰策略 | LRU | 最近最少使用 |

### 安全设置

| 配置项 | 说明 |
|--------|------|
| 令牌验证 | 严格匹配用户令牌 |
| 路径验证 | 防止目录遍历攻击（`../`、双斜杠等） |
| 文件类型 | 支持 text、image、application、audio、video |
| 路径长度限制 | 最大 1000 字符 |

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| 缓存命中响应时间 | < 50ms |
| 缓存未命中响应时间 | < 1000ms |
| 最大并发请求 | Vercel 自动扩缩容 |
| 内存使用 | 优化的内存管理 |
| 支持的文件类型 | 文本、图片、应用、音频、视频 |

---

## 📂 项目结构

```text
github-raw/
├── api/
│   └── github-raw.js          # 主服务文件（单文件架构）
├── .gitignore                 # Git 忽略配置
├── .nvmrc                     # Node 版本配置
├── package.json               # 项目配置
├── package-lock.json          # 依赖锁定文件
├── vercel.json                # Vercel 部署配置
├── README.md                  # 项目文档（本文件）
└── IFLOW.md                   # 详细技术文档
```

---

## 🔧 核心组件

### 1. 速度限制器（RateLimiter）

使用滑动窗口算法控制请求频率，防止恶意刷接口。

```javascript
class RateLimiter {
  constructor(maxRequests = 10) {
    this.maxRequests = maxRequests;
    this.windowMs = 1000; // 1秒时间窗口
    this.requests = [];
  }
  
  isAllowed() {
    // 清理过期请求，检查是否超限
    // 返回 true/false
  }
}
```

### 2. 缓存系统（SimpleCache）

基于 Map 的内存缓存，支持自动过期和 LRU 淘汰。

```javascript
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }
  
  set(key, value, ttl) {
    // 存储数据，设置过期定时器
  }
  
  get(key) {
    // 获取数据，检查是否过期
  }
}
```

### 3. 安全验证

- **令牌验证**：严格匹配用户令牌
- **路径验证**：防止目录遍历攻击
- **文件类型验证**：白名单机制

---

## 🛡️ 安全特性

- ✅ **输入验证**：严格的参数和路径验证
- ✅ **令牌保护**：防止未授权访问
- ✅ **路径安全**：防止目录遍历攻击
- ✅ **错误处理**：统一错误处理，不暴露敏感信息
- ✅ **跨域控制**：完整的 CORS 配置

---

## 🚀 部署指南

### Vercel 部署

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录 Vercel
vercel login

# 3. 部署
vercel

# 4. 生产环境部署
vercel --prod
```

### 环境变量配置

在 Vercel 控制台的 `Settings > Environment Variables` 中添加：

```bash
NINE49TOKEN=your_secure_token_here
GITHUB49TOKEN=your_github_token_here  # 可选
```

---

## 📝 更新日志

### v2026.01.16.165956

- 🎉 全面优化代码结构，提升可读性和可维护性
- ✨ 提取常量，消除重复代码
- 🚀 优化辅助函数，减少代码重复
- 💾 简化注释，保留有价值说明
- ✅ 完整的功能测试和回归测试

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

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📞 支持

如有问题或建议，请：

- 📧 创建 [Issue](https://github.com/Nine499/github-raw/issues)
- 💬 参与 [Discussions](https://github.com/Nine499/github-raw/discussions)

---

## 🙏 致谢

- [Vercel](https://vercel.com) - 提供优秀的 Serverless 平台
- [GitHub](https://github.com) - 提供原始文件托管服务

---

**Made with ❤️ by [Nine499](https://github.com/Nine499)**
