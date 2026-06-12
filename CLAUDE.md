# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

这是一个部署到 Vercel 的极简 GitHub Raw 文件代理。外部请求通过 Vercel rewrite 进入单个 API 函数，再转发到 `https://raw.githubusercontent.com/`。

核心外部契约来自 `README.md` 与 `vercel.json`：

- 请求格式：`https://<domain>/<owner>/<repo>/<branch>/<file-path>?nine-token=<NINE49TOKEN>`
- 路由规则：`/:path*` → `/api/github-raw.js?path=:path*`
- 必填环境变量：`NINE49TOKEN`
- 可选环境变量：`GITHUB49TOKEN`
- token 错误或缺失返回 `403 Forbidden`
- `path` 为空返回 `400 Bad Request`
- 上游网络级请求失败返回 `502 Bad Gateway`
- 其他情况透传上游状态码，响应体保持原始字节流，不包裹 JSON
- 固定缓存头：`Cache-Control: public, max-age=300, s-maxage=3600`

## 架构与请求链路

- `vercel.json` 是入口路由层：把任意路径写入查询参数 `path`，并交给 `api/github-raw.js`。
- `api/github-raw.js` 是唯一业务入口：
  1. 读取 `NINE49TOKEN` / `GITHUB49TOKEN`
  2. 从 URL 查询参数读取 `nine-token` 与 `path`
  3. 校验 token 与空路径
  4. 拼接 `https://raw.githubusercontent.com/${path}`
  5. 转发协商缓存/范围请求相关头到 GitHub Raw
  6. 设置固定缓存头、透传部分上游响应头
  7. 用 Node stream 流式转发上游响应体到客户端

当前实现没有依赖包、没有构建系统、没有测试框架，也没有 npm scripts。不要为小改动引入依赖管理或构建层；除非需求明确扩大，否则保持单函数结构。

## 常用命令

仓库没有 `package.json`，因此当前没有 `npm run build`、`npm test`、`npm run lint` 或单测命令。

可用的最小检查命令：

```bash
node --check api/github-raw.js
```

```bash
node --input-type=module -e "await import('./api/github-raw.js')"
```

查看本次改动：

```bash
git diff -- api/github-raw.js README.md vercel.json CLAUDE.md
```

部署后可用 HTTP 合约检查：

```bash
curl -i 'https://<domain>/?nine-token=<NINE49TOKEN>'
```

预期：空路径返回 `400 Bad Request`。

```bash
curl -i 'https://<domain>/octocat/Hello-World/master/README'
```

预期：缺少 `nine-token` 返回 `403 Forbidden`。

```bash
curl -i 'https://<domain>/octocat/Hello-World/master/README?nine-token=<NINE49TOKEN>'
```

预期：状态码跟随 GitHub Raw，响应包含固定 `Cache-Control`，响应体是原始文件内容。

## 修改注意事项

- 保持现有 URL、查询参数名、环境变量名和错误状态码语义，避免破坏调用方。
- `path` 由 `vercel.json` rewrite 注入；修改路由时必须同步检查 `api/github-raw.js` 的 `path` 读取逻辑与 README。
- 性能关键路径是响应体转发；避免改回 `arrayBuffer()` / `Buffer` 整包读入。
- 响应头目前只透传白名单中的缓存与范围请求相关头，新增透传头时要确认不会暴露不必要的上游实现细节。
- README 是对外契约说明；修改鉴权、缓存、错误码、响应头或路由时同步更新 README。
