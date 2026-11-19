# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

本仓库是一个部署在 Vercel 上的极简 GitHub Raw 代理。它没有应用框架、依赖管理文件或构建层；Vercel 将所有访问路径重写到唯一的 API 函数，由该函数鉴权后请求 `https://raw.githubusercontent.com/`，再把上游内容返回给客户端。

对外行为以 `README.md`、`vercel.json` 和 `api/github-raw.js` 的实际实现为准。修改其中任意一个文件时，先核对三者是否仍然描述同一份契约。

## 开始工作前

1. 读取本文件、`README.md`、`vercel.json` 和 `api/github-raw.js` 的当前内容。
2. 执行 `git status --short` 和针对目标文件的 `git diff`，识别已有改动；不要覆盖与当前任务无关的未提交内容。
3. 确认任务所需的最小文件范围。通常业务改动只涉及 `api/github-raw.js`，路由改动还必须检查 `vercel.json`，对外行为改动还必须同步 `README.md`。
4. 这是无依赖的单函数项目，不要为小改动引入 `package.json`、构建系统、测试框架或第三方依赖。

## 文件职责与请求链路

### `vercel.json`：路由入口

唯一 rewrite 规则是：

```text
/:path*  →  /api/github-raw.js?path=:path*
```

因此用户访问的路径不会直接命中静态文件，而是作为 `path` 查询参数交给 API。路由规则负责把路径交给函数，不负责鉴权、上游请求或响应处理。改动 `source`、`destination` 或参数名称时，必须同时检查 API 的读取逻辑和 README 中的 URL 示例。

### `api/github-raw.js`：唯一业务入口

函数按以下顺序处理请求：

1. 生成 `requestId` 并记录开始时间；读取 `NINE49TOKEN` 和可选的 `GITHUB49TOKEN`。
2. 使用 `new URL(req.url, ...)` 读取 `path` 与 `nine-token`。会移除 `path` 开头的 `/`，使它可以拼接到 Raw 基地址后。
3. 将鉴权状态归类为 `missing`、`not-configured`、`invalid` 或 `valid`。只有完全匹配 `NINE49TOKEN` 才继续。
4. 鉴权失败或路径为空时，记录脱敏摘要并返回 `302`，固定跳转到 `https://www.baidu.com/`。
5. 构造上游请求：始终发送固定 `User-Agent`；若配置 `GITHUB49TOKEN`，发送 `Authorization: token <value>`。
6. 仅转发协商缓存和范围请求相关的客户端请求头：`If-None-Match`、`If-Modified-Since`、`Range`、`If-Range`。
7. 请求 GitHub Raw。网络请求异常，或上游状态为 `400` 及以上时，记录结果并执行同一个固定 `302` 跳转。
8. 对未达到 `400` 的上游响应透传状态码，设置固定 `Cache-Control`，透传 `Content-Type`（缺失时使用 `application/octet-stream`），并白名单透传 `ETag`、`Last-Modified`、`Accept-Ranges`、`Content-Range`。
9. 使用 `Readable.fromWeb()` 和 `pipeline()` 将上游 Web stream 流式写入 Vercel response；不得改回 `arrayBuffer()`、`Buffer` 或其他整包读入方式。
10. 尽力写入脱敏的 Runtime Logs。日志可以包含请求 ID、method、安全截断路径、路径长度、鉴权分类、结果分类、状态和耗时，但不能包含 token、Authorization、Cookie、IP、完整查询字符串、请求体或响应体。

## 对外契约与不变量

- 必填环境变量：`NINE49TOKEN`。未配置时所有请求都视为未通过鉴权。
- 可选环境变量：`GITHUB49TOKEN`。它只用于请求 GitHub Raw，不能出现在日志或客户端响应中。
- 公共请求格式：`/<owner>/<repo>/<branch>/<file-path>?nine-token=<NINE49TOKEN>`。
- `nine-token` 缺失、错误或服务端 token 未配置：`302` 到固定百度地址。
- `path` 为空：`302` 到固定百度地址。
- 上游网络失败或状态码 `>= 400`：`302` 到固定百度地址；不会把上游错误正文返回给客户端。
- 其他上游状态码透传，包括成功状态和实现允许的非错误状态；响应体保持原始字节流，不包装 JSON。
- 成功响应固定使用 `Cache-Control: public, max-age=300, s-maxage=3600`。
- 错误跳转使用 `Cache-Control: no-store`，且 `Location` 不得拼入原始路径、查询参数或令牌。
- 上游响应头只能通过白名单透传；新增头部前要评估是否泄露不必要的上游实现细节。
- 不要把用户可控的完整 URL、查询字符串或敏感请求头写入日志。

## 常用命令

仓库当前没有 `package.json`，因此没有 `npm run build`、`npm test`、`npm run lint` 或单文件测试命令。不要把这些不存在的命令写成已支持的工作流。

### 语法与模块检查

```bash
node --check api/github-raw.js
node --input-type=module -e "await import('./api/github-raw.js')"
```

第一条检查语法，第二条确认 ES module 可以被 Node 加载。它们都不会模拟 Vercel 请求，也不会发起上游请求。

### 查看改动

```bash
git status --short
git diff -- api/github-raw.js README.md vercel.json CLAUDE.md
git diff --check
```

### 部署后的最小 HTTP 合约检查

将 `<domain>` 和 `<NINE49TOKEN>` 替换为实际值；不要把真实 token 粘贴到共享日志、提交或文档中。测试重定向本身时，使用 `curl -i`，不要使用 `-L` 自动跟随：

```bash
curl -i 'https://<domain>/?nine-token=<NINE49TOKEN>'
curl -i 'https://<domain>/octocat/Hello-World/master/README'
curl -i 'https://<domain>/octocat/Hello-World/master/README?nine-token=<NINE49TOKEN>'
```

预期分别是空路径错误跳转、缺少 token 的鉴权错误跳转，以及在有效配置下跟随 GitHub Raw 的非错误状态、原始响应体和固定缓存头。第三条依赖网络、Vercel 部署和上游仓库可用，不能用本地语法检查替代。

## 修改与验证策略

- 先定位根因，再做最小 diff；保持现有命名、缩进、注释密度和单函数结构。
- 修改鉴权、错误状态、重定向、缓存、响应头或流式转发时，必须同步核对 README 的对应章节。
- 修改 rewrite 时，必须验证 `path` 查询参数仍能正确到达 API。
- 涉及行为变化时，至少运行与变化直接相关的本地检查；可访问已部署环境时再运行对应的 `curl` 合约检查。
- 没有现成测试框架时，不要为了单次小改动建立测试基础设施；报告中明确说明未执行的行为验证。
- 流式转发的错误处理要考虑响应可能已经开始发送：不要在客户端已收到部分响应后尝试发送第二个响应。
- 任何新增日志字段都必须逐项检查是否可能包含秘密、完整输入或个人/网络标识。

## 部署与配置边界

部署目标是 Vercel。仓库没有构建步骤，入口配置在 `vercel.json`，运行时环境变量在 Vercel 项目设置中配置。环境变量名称、公开 URL 形状和查询参数名称属于兼容性契约，除非任务明确要求迁移，否则不要重命名或改变语义。

## 当前限制

- 本地没有依赖、构建脚本或自动化测试。
- 业务函数依赖 Vercel 的 Node.js API response 方法（例如 `res.status()`、`res.setHeader()`、`res.redirect()`）以及 Node 对 Web stream 的支持；不要直接假设它等同于普通浏览器函数。
- 代理只实现固定的路径转发和少量头部白名单，不要未经明确需求扩展为通用 HTTP 代理。
- README 是面向使用者的行为说明；本文件是面向未来 Agent 的工程说明，避免在两处复制整段内容，分别维护各自需要的细节。
