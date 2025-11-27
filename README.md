# GitHub Raw 代理服务

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nine499/github-raw)

一个高性能、安全可靠的 GitHub 原始文件代理服务，支持缓存、验证和详细日志记录。

## ✨ 特性

- 🚀 **高性能**: 智能内存缓存，显著提升响应速度
- 🔒 **安全可靠**: 多层验证机制，防止恶意访问
- 📊 **详细日志**: 完整的请求和错误日志记录
- 🌐 **跨域支持**: 完整的 CORS 配置
- 📱 **响应式设计**: 支持各种文件类型和大小
- 🛠️ **易于维护**: 模块化架构，清晰的代码结构

## 🚀 快速开始

### 1. 部署到 Vercel

点击上方按钮，或执行以下步骤：

```bash
# 克隆项目
git clone https://github.com/Nine499/github-raw.git
cd github-raw

# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

### 2. 环境变量配置

在 Vercel 控制台设置以下环境变量：

| 变量名          | 描述                | 必需 |
| --------------- | ------------------- | ---- |
| `NINE49TOKEN`   | 用户验证令牌        | ✅   |
| `GITHUB49TOKEN` | GitHub API 访问令牌 | ⚠️   |
| `NODE_ENV`      | 运行环境            | ❌   |

### 3. 使用方法

```bash
# 基本用法
GET https://your-domain.com/owner/repo/main/path/to/file.txt?nine-token=YOUR_TOKEN

# 示例
GET https://your-domain.com/microsoft/vscode/main/package.json?nine-token=your_valid_token
```

## 📖 API 文档

### 请求格式

```text
GET /{github_path}?nine-token={your_token}
```

**参数说明**:

- `github_path`: GitHub 文件路径，格式为 `{owner}/{repo}/{branch}/{path_to_file}`
- `nine-token`: 验证令牌

### 响应格式

#### 成功响应 (200 OK)

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=300
X-Cache: MISS
Access-Control-Allow-Origin: *

{文件内容}
```

#### 失败响应

所有失败情况都会重定向到安全页面 (`https://www.baidu.com`)

### 支持的文件类型

- 📄 文本文件 (`.txt`, `.md`, `.json`, `.js`, `.css`, `.html`)
- 🖼️ 图片文件 (`.png`, `.jpg`, `.gif`, `.svg`, `.webp`)
- 📦 应用文件 (`.pdf`, `.zip`, `.tar.gz`)
- 🎵 音频文件 (`.mp3`, `.wav`, `.ogg`)
- 🎬 视频文件 (`.mp4`, `.webm`, `.ogg`)

## 🏗️ 项目架构

```text
github-raw/
├── api/
│   ├── github-raw.js          # 主入口文件
│   ├── config/
│   │   └── constants.js       # 配置常量
├── services/
│   ├── github.js              # GitHub API 服务
│   └── cache.js               # 缓存服务
├── utils/
│   ├── validation.js          # 验证工具
│   ├── errors.js              # 错误处理
│   └── logger.js              # 日志工具
└── middleware/                # 中间件 (预留)
```

## ⚙️ 配置选项

### 缓存配置

- **TTL**: 300 秒 (5 分钟)
- **最大条目**: 100 个
- **淘汰策略**: LRU (最近最少使用)

### 安全配置

- **路径长度限制**: 1000 字符
- **重定向 URL**: `https://www.baidu.com`
- **令牌验证**: 严格匹配

### 性能配置

- **请求超时**: 10 秒
- **并发限制**: 无限制 (Vercel 自动处理)
- **内存使用**: 优化的内存管理

## 🔧 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/Nine499/github-raw.git
cd github-raw

# 创建环境变量文件
echo "NINE49TOKEN=your_token_here" > .env.local
echo "GITHUB49TOKEN=your_github_token" >> .env.local

# 启动开发服务器
vercel dev
```

### 代码结构

#### 主控制器 (`github-raw.js`)

```javascript
export default async function handler(request, response) {
  // 1. 请求验证
  // 2. 缓存检查
  // 3. GitHub API 调用
  // 4. 响应返回
  // 5. 错误处理
}
```

#### 验证工具 (`validation.js`)

```javascript
RequestValidator.validateToken(token, expected);
RequestValidator.validatePath(path);
RequestValidator.validateRequest(query);
```

#### 缓存服务 (`cache.js`)

```javascript
CacheService.get(path, token);
CacheService.set(path, token, response);
CacheService.getStats();
```

### 调试技巧

```javascript
// 开发环境启用调试日志
if (process.env.NODE_ENV === "development") {
  Logger.debug("调试信息", { request, headers });
}

// 查看缓存统计
console.log(CacheService.getStats());
```

## 📊 性能优化

### 缓存策略

- **内存缓存**: 快速响应频繁访问的文件
- **智能淘汰**: 自动清理过期和最少使用的缓存
- **预热机制**: 支持批量预加载热门文件

### 网络优化

- **请求超时**: 避免长时间等待
- **连接复用**: 优化网络连接
- **压缩支持**: 自动压缩响应内容

### 监控指标

- **响应时间**: 平均 < 100ms (缓存命中)
- **缓存命中率**: 目标 > 70%
- **错误率**: < 1%

## 🔒 安全特性

### 输入验证

- **路径格式验证**: 防止路径遍历攻击
- **文件类型检查**: 只允许安全文件类型
- **长度限制**: 防止过长输入

### 访问控制

- **令牌验证**: 严格的身份验证
- **频率限制**: 防止 API 滥用
- **IP 记录**: 完整的访问日志

### 错误处理

- **信息隐藏**: 不泄露敏感信息
- **统一重定向**: 安全的错误页面
- **详细日志**: 便于问题排查

## 🚀 部署指南

### Vercel 部署

1. **连接 GitHub 仓库**
2. **设置环境变量**
3. **配置域名** (可选)
4. **启用分析** (推荐)

### 自定义域名

```bash
# 添加自定义域名
vercel domains add your-domain.com

# 配置 DNS
# CNAME -> cname.vercel-dns.com
```

### 环境变量管理

| 环境 | 变量文件      | 用途     |
| ---- | ------------- | -------- |
| 开发 | `.env.local`  | 本地开发 |
| 预览 | Vercel 控制台 | PR 预览  |
| 生产 | Vercel 控制台 | 正式环境 |

## 📝 更新日志

### v2.1.0 (最新)

- ✨ 新增智能缓存机制
- 🚀 性能提升 50%
- 📊 缓存统计和监控
- 🔧 优化的错误处理

### v2.0.0

- 🎉 完全重构为模块化架构
- ✨ 增强的安全性和验证
- 📊 完善的日志系统
- 📝 详细的中文注释

### v1.0.0

- 🎯 基础功能实现
- 🔑 令牌验证
- 📁 GitHub 文件代理

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request
