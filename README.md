# GitHub Raw 代理服务（极客精简版）

这是一个部署在 Vercel 的 GitHub Raw 代理服务，用于安全、快速地获取 `raw.githubusercontent.com` 上的文件内容。它通过 Vercel Edge Cache 提升访问速度，并提供简单的令牌校验，避免被滥用。

## 适用场景

- 需要在受限网络中访问 GitHub Raw 文件
- 希望通过统一域名代理 GitHub 静态资源
- 对图片/二进制文件直链有稳定可用的需求

## 功能特性

- **Token 保护**：必须携带 `nine-token` 才能访问
- **全类型透传**：文本、图片、二进制一律原样返回
- **Edge 缓存**：通过 `s-maxage` 利用 Vercel 全球节点缓存
- **健康检查**：`/health` 返回运行状态

## 运行方式

### 1. 部署到 Vercel

直接将仓库导入 Vercel 即可，无需额外构建步骤。`vercel.json` 已配置重写规则，所有请求会转发到 API：

- `/(.*)` → `/api/github-raw.js?path=$1`

### 2. 配置环境变量

在 Vercel 项目设置中添加以下变量：

- `NINE49TOKEN`：访问令牌，必填
- `GITHUB49TOKEN`：GitHub Token，可选（用于提升 GitHub API 访问额度）

### 3. 访问方式

请求格式：

```
https://<your-vercel-domain>/<owner>/<repo>/<branch>/<path>?nine-token=<NINE49TOKEN>
```

示例：

```
https://your-app.vercel.app/owner/repo/main/assets/logo.png?nine-token=YOUR_TOKEN
```

## 接口说明

### 文件代理

- **请求**：`GET /<path>?nine-token=<token>`
- **行为**：转发到 `https://raw.githubusercontent.com/<path>`
- **响应**：透传二进制数据，并保留原始 `content-type`

### 健康检查

- **请求**：`GET /health?nine-token=<token>`
- **响应示例**：

```
{
  "status": "ok",
  "uptime": "123s",
  "cache": "Vercel Edge"
}
```

## 缓存策略

响应头：

- `Cache-Control: public, max-age=300, s-maxage=3600`

说明：

- 浏览器缓存 5 分钟
- Vercel Edge 缓存 1 小时

## 安全机制

- 未携带或令牌错误：直接重定向到 `https://www.baidu.com`
- 未提供路径：直接重定向

> 如需替换重定向地址，可在 `api/github-raw.js` 中修改 `REDIRECT_URL`。

## 项目结构

```
.
├── api/
│   └── github-raw.js   # 代理逻辑
├── vercel.json         # 重写规则
└── README.md
```

## 使用建议

- 推荐开启 `GITHUB49TOKEN`，避免匿名请求被限流
- 静态资源（图片、字体等）更适合走此代理通道
- 如果需要更细粒度的权限控制，可在 API 中加入路径白名单

## 常见问题

### 1. 为什么不使用内存缓存？

该项目为 Serverless 部署，实例无状态且随时销毁。内存缓存命中率低且不稳定，因此改为依赖 Vercel Edge Cache。

### 2. 为什么不做内存限流？

单实例限流无法对抗分布式流量，Vercel 已提供平台级 DDoS 防护，保持代码极简更可靠。

### 3. 访问被重定向到百度？

说明 `nine-token` 不正确或未提供 `path` 参数。请确认访问格式与环境变量配置。

## License

自行维护与扩展，无附带任何保证。
