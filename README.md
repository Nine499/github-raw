# GitHub Raw 代理服务（极简直通版）

一个部署在 Vercel 的 GitHub Raw 代理服务。
目标是用最少逻辑实现稳定透传：保留 token 鉴权、透传上游状态码与内容、并使用 Vercel Edge Cache 提升命中率。

## 功能特性

- **Token 鉴权**：必须携带 `nine-token` 才能访问
- **全类型透传**：文本、图片、二进制统一原样返回
- **状态码透传**：上游 `raw.githubusercontent.com` 的状态码直接返回
- **Edge Cache**：`Cache-Control: public, max-age=300, s-maxage=3600`

## 运行方式

### 1) 部署到 Vercel

直接导入仓库即可，无需额外构建步骤。

`vercel.json` 已配置重写：

- `/(.*)` → `/api/github-raw.js?path=$1`

### 2) 配置环境变量

在 Vercel 项目设置中添加：

- `NINE49TOKEN`（必填）：访问令牌
- `GITHUB49TOKEN`（可选）：GitHub Token，用于提升匿名访问限制下的可用性

### 3) 访问格式

```text
https://<your-vercel-domain>/<owner>/<repo>/<branch>/<path>?nine-token=<NINE49TOKEN>
```

示例：

```text
https://your-app.vercel.app/owner/repo/main/assets/logo.png?nine-token=YOUR_TOKEN
```

## 接口说明

### 文件代理

- **请求**：`GET /<path>?nine-token=<token>`
- **行为**：转发到 `https://raw.githubusercontent.com/<path>`
- **响应**：
  - 状态码透传上游
  - `Content-Type` 透传上游（缺失时为 `application/octet-stream`）
  - Body 以二进制方式透传

## 缓存策略

统一响应头：

- `Cache-Control: public, max-age=300, s-maxage=3600`

含义：

- 浏览器缓存 5 分钟
- Vercel Edge 缓存 1 小时

## 安全机制

- `nine-token` 缺失或不匹配：返回 `403 Forbidden`
- `path` 缺失或为空：返回 `400 Bad Request`

## 项目结构

```text
.
├── api/
│   └── github-raw.js
├── vercel.json
└── README.md
```

## 常见问题

### 为什么返回 403 或 400？

- `403 Forbidden`：`nine-token` 缺失或不正确
- `400 Bad Request`：未提供有效 `path`

### 为什么不做内存缓存与内存限流？

该项目运行在 Serverless 环境，实例无状态且可回收：

- 内存缓存命中率与稳定性都不理想
- 单实例限流无法覆盖分布式流量

因此保持代理层极简，缓存交给 Edge，防护依赖平台能力。

## License

自行维护与扩展，无附带任何保证。
