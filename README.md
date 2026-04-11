# GitHub Raw 代理（Vercel）

一个部署在 Vercel 的极简代理服务，用于转发 `raw.githubusercontent.com` 文件内容。

目标：
- 保留最小必要鉴权（`nine-token`）
- 原样透传上游状态码与内容类型
- 使用 Vercel Edge Cache 提高命中率

---

## 功能说明

- **Token 鉴权**：请求必须带 `nine-token`
- **状态码透传**：上游返回什么状态码，就返回什么状态码
- **内容透传**：支持文本、图片、二进制文件
- **缓存策略**：
  - 浏览器缓存：`max-age=300`（5 分钟）
  - Edge 缓存：`s-maxage=3600`（1 小时）

---

## 项目结构

```text
.
├── api/
│   └── github-raw.js
├── vercel.json
└── README.md
```

---

## 部署

直接将仓库导入 Vercel 即可，无需构建步骤。

当前 `vercel.json` 重写规则：

- `/:path*` → `/api/github-raw.js?path=:path*`

含义：访问任意路径时，都会转发到代理函数，并把原路径放到 `path` 参数。

---

## 环境变量

在 Vercel 项目中配置：

- `NINE49TOKEN`（必填）
  - 访问令牌；请求中的 `nine-token` 必须与它完全一致
- `GITHUB49TOKEN`（可选）
  - GitHub Token；配置后会以 `Authorization` 请求上游，提升限流场景下可用性

---

## 使用方式

请求格式：

```text
https://<你的域名>/<owner>/<repo>/<branch>/<file-path>?nine-token=<NINE49TOKEN>
```

示例：

```text
https://your-app.vercel.app/octocat/Hello-World/master/README?nine-token=YOUR_TOKEN
```

上面请求会被代理到：

```text
https://raw.githubusercontent.com/octocat/Hello-World/master/README
```

---

## 返回行为

- `nine-token` 不正确或缺失：`403 Forbidden`
- `path` 为空：`400 Bad Request`
- 其他情况：
  - 状态码透传上游
  - `Content-Type` 透传上游
  - 若上游未返回 `Content-Type`，使用 `application/octet-stream`

---

## 适用场景

- 需要通过私有令牌控制访问的 Raw 文件代理
- 需要统一缓存策略、减少重复回源
- 需要稳定转发文本/图片/二进制资源

---

## License

`License` 文件已在仓库根目录提供。