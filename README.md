# GitHub Raw 代理服务

> 🚀 一个简单、高效、安全的 GitHub 原始文件代理服务，专为加速访问而设计

[![Version](https://img.shields.io/badge/version-2026.01.16.175755-blue)](https://github.com/Nine499/github-raw/releases)
[![Node](https://img.shields.io/badge/node-%3E%3D24.0.0-green)](https://nodejs.org)
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
✅ **现代标准** - 使用 WHATWG URL API，避免弃用警告  

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

- Node.js >= 24.0.0
- npm 或 yarn
- Vercel CLI（可选，用于本地开发）

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

### 测试示例

```bash
# 测试基本功能
curl "http://localhost:3000/Nine499/github-raw/master/README.md?nine-token=YOUR_TOKEN"

# 测试缓存（第二次请求应该更快）
curl "http://localhost:3000/Nine499/github-raw/master/README.md?nine-token=YOUR_TOKEN"
```

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

### 错误处理

| 错误原因 | HTTP 状态码 | 说明 |
|----------|-------------|------|
| 缺少令牌 | 302 | 未提供 `nine-token` 参数 |
| 令牌无效 | 302 | 令牌与环境变量不匹配 |
| 请求频率超限 | 302 | 超过每秒 10 次请求限制 |
| 路径无效 | 302 | 路径格式错误或包含危险字符 |
| GitHub API 错误 | 302 | GitHub 请求失败或超时 |
| 文件类型不支持 | 302 | 文件类型不在白名单中 |

---

## ⚙️ 配置参数

### 速度限制

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_REQUESTS_PER_SECOND` | 10 | 每秒最多允许的请求数 |
| `RATE_LIMIT_WINDOW_MS` | 1000 | 时间窗口（毫秒） |
| 超限处理 | 重定向 | 超限时重定向到安全页面 |

### 缓存策略

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CACHE_TTL` | 300 | 缓存存活时间（秒），5 分钟 |
| `CACHE_MAX_SIZE` | 100 | 最多缓存文件数量 |
| 淘汰策略 | LRU | 最近最少使用 |

### GitHub API

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `GITHUB_BASE_URL` | `https://raw.githubusercontent.com` | GitHub 原始文件基础 URL |
| `REQUEST_TIMEOUT` | 10000 | 请求超时时间（毫秒），10 秒 |

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
| 速度限制 | 10 请求/秒（滑动窗口） |
| 缓存容量 | 100 个文件（LRU 淘汰） |
| 缓存时长 | 5 分钟（300 秒） |

---

## 📂 项目结构

```text
github-raw/
├── api/
│   └── github-raw.js          # 主服务文件（单文件架构）
├── .gitignore                 # Git 忽略配置
├── .nvmrc                     # Node 版本配置
├── package.json               # 项目配置
├── vercel.json                # Vercel 部署配置
├── README.md                  # 项目文档（本文件）
└── IFLOW.md                   # 详细技术文档
```

## 🏗️ 技术架构

### 技术栈

- **运行时**：Node.js >= 24.0.0
- **部署平台**：Vercel Serverless Functions
- **编程语言**：JavaScript (ES2022+)
- **架构模式**：单文件模块化设计

### 核心技术

- **WHATWG URL API**：现代标准，避免弃用警告
- **ES 模块**：原生模块支持，无需打包
- **Fetch API**：现代网络请求标准
- **AbortSignal**：请求超时控制

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

### 3. 请求参数解析（parseRequestParams）

使用 WHATWG URL API 解析请求参数，兼容 Vercel 的路由重写。

```javascript
function parseRequestParams(request) {
  const requestUrl = new URL(request.url || '', `http://${request.headers.host}`);
  const userToken = requestUrl.searchParams.get('nine-token');
  const githubPath = requestUrl.searchParams.get('path');
  
  return {
    userToken: userToken || request.query?.['nine-token'],
    githubPath: githubPath || request.query?.path,
  };
}
```

### 4. 安全验证

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
- ✅ **现代标准**：使用 WHATWG URL API，避免弃用警告和安全隐患

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
NINE49TOKEN=your_secure_token_here              # 必需：用户验证令牌
GITHUB49TOKEN=your_github_token_here            # 可选：GitHub API 令牌
NODE_NO_WARNINGS=1                              # 可选：抑制弃用警告
```

### Vercel 配置

项目使用 `rewrites` 配置，将所有请求重定向到 `api/github-raw.js`：

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/github-raw.js?path=$1"
    }
  ]
}
```

---

## 📝 更新日志

### v2026.01.16.175755

- 🎉 修复 Node.js 弃用警告（url.parse()）
- ✨ 使用 WHATWG URL API 构建和解析请求 URL
- 🚀 新增 parseRequestParams() 函数，统一参数解析
- 🔧 优化 Vercel 配置（routes 改为 rewrites）
- 💾 提取常量，添加 JSDoc 注释
- ✅ 完整的功能测试和回归测试

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
- [Node.js](https://nodejs.org) - 提供 JavaScript 运行时
- [WHATWG URL API](https://url.spec.whatwg.org/) - 提供现代 URL 处理标准

---

**Made with ❤️ by [Nine499](https://github.com/Nine499)**
