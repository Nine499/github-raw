# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

本仓库是一个部署在 Vercel 上的极简 GitHub Raw 代理。没有应用框架、没有运行时依赖、没有构建步骤；Vercel 将所有访问路径重写到唯一的 API 函数，由该函数鉴权后请求 `https://raw.githubusercontent.com/`，再把上游内容返回给客户端。

技术形态是 Vercel 现行推荐的 **Node.js runtime + Web 标准 `fetch(request)` 签名**：函数只依赖 Web 标准 API（`Request`、`Response`、`Headers`、`fetch`）加一个 `node:crypto` 的 `randomUUID`。业务逻辑拆在 `src/`，`api/index.ts` 只做装配。

对外行为以 `README.md`、`vercel.json` 和 `api/index.ts`（及其引用的 `src/` 模块）的实际实现为准。修改其中任意一个文件时，先核对三者是否仍然描述同一份契约。

## 开始工作前

1. 读取本文件、`README.md`、`vercel.json`、`api/index.ts` 与 `src/` 全部模块的当前内容。
2. 执行 `git status --short` 和针对目标文件的 `git diff`，识别已有改动；不要覆盖与当前任务无关的未提交内容。
3. 确认任务所需的最小文件范围。业务行为通常落在 `src/` 的某个模块；路由改动还必须检查 `vercel.json`，对外行为改动还必须同步 `README.md`。
4. 运行时依赖保持为零：`package.json` 只允许 devDependencies（typescript、biome、@types/node）。不要引入运行时依赖、框架或构建层。

## 文件职责与请求链路

### `vercel.json`：路由入口

唯一 rewrite 规则是：

```text
/:path*  →  /api/index?path=:path*
```

用户访问的路径不直接命中静态文件，而是作为 `path` 查询参数交给函数。destination 不带扩展名，与 Vercel 官方 rewrite 文档的示例一致。改动 `source`、`destination` 或参数名称时，必须同时检查 API 的读取逻辑和 README 中的 URL 示例。

### `api/index.ts`：唯一业务入口

函数按以下顺序处理请求：

1. 生成 `requestId` 并记录开始时间。
2. 使用 `new URL(request.url)` 读取 `path` 与 `nine-token`；移除 `path` 开头的 `/`，使其可拼接到 Raw 基地址后。
3. `classifyAuth()` 归类鉴权状态为 `missing`、`not-configured`、`invalid` 或 `valid`；只有完全匹配 `NINE49TOKEN` 才继续。
4. 鉴权失败或路径为空时，记录脱敏摘要并返回 `302` 到固定百度地址。
5. `fetchUpstream()` 请求 GitHub Raw：固定 `User-Agent`；若配置 `GITHUB49TOKEN` 则带 `Authorization`；只转发 `If-None-Match`、`If-Modified-Since`、`Range`、`If-Range` 四个客户端请求头。
6. 网络异常或上游状态 `>= 400` 时，记录结果并执行同一固定 `302`。
7. 其余状态交 `successResponse()`：透传状态码，设置固定 `Cache-Control`，透传 `Content-Type`（缺失用 `application/octet-stream`），白名单透传 `ETag`、`Last-Modified`、`Accept-Ranges`、`Content-Range`；响应体直接使用上游 `ReadableStream`。

### `src/` 模块划分

- `config.ts`：环境变量名（`NINE49TOKEN`、`GITHUB49TOKEN`）与所有固定常量。环境变量名与 `nine-token` 参数名是兼容性契约，不可重命名。
- `auth.ts`：`classifyAuth()` 四分类，纯函数。
- `upstream.ts`：上游请求头白名单与 `fetchUpstream()`。
- `proxy-response.ts`：`errorRedirect()`（302 + no-store）与 `successResponse()`（流式透传）。
- `log.ts`：`logAccess()` 与 `safePath()`；路径脱敏在模块内部完成，调用方传原始值。

模块边界原则：新增行为先看该落在哪个 `src/` 模块；`api/index.ts` 保持装配层，不写业务细节。五个模块够用时不要再拆。

## 对外契约与不变量

- 必填环境变量：`NINE49TOKEN`。未配置时所有请求都视为未通过鉴权。
- 可选环境变量：`GITHUB49TOKEN`。只用于请求 GitHub Raw，不能出现在日志或客户端响应中。
- 公共请求格式：`/<owner>/<repo>/<branch>/<file-path>?nine-token=<NINE49TOKEN>`。
- `nine-token` 缺失、错误或服务端 token 未配置：`302` 到固定百度地址。
- `path` 为空：`302` 到固定百度地址。
- 上游网络失败或状态码 `>= 400`：`302` 到固定百度地址；不把上游错误正文返回给客户端。
- 其他上游状态码透传；响应体保持原始流，不包装 JSON。
- 成功响应固定 `Cache-Control: public, max-age=300, s-maxage=3600`。
- 错误跳转 `Cache-Control: no-store`，`Location` 不拼入原始路径、查询参数或令牌。
- 上游请求头与响应头都走白名单；新增头部前评估缓存、隐私与实现细节暴露。
- 不要把用户可控的完整 URL、查询字符串或敏感请求头写入日志。

## 常用命令

Node 版本以 `.node-version` 为准（fnm use）；包管理只用 pnpm。

### 检查

```bash
pnpm run typecheck      # tsc --noEmit，类型检查
pnpm run biome:check    # Biome 检查
pnpm run biome:fix      # Biome 自动修复
```

### 本地冒烟测试

Node 24 原生支持 TS type stripping，可不经构建直接驱动函数（会真实访问 GitHub Raw）：

```bash
NINE49TOKEN=testtoken node --input-type=module -e "
const mod = await import('./api/index.ts');
const h = mod.default;
const res = await h(new Request('https://x.vercel.app/api/index?path=octocat/Hello-World/master/README&nine-token=testtoken'));
console.log(res.status, res.headers.get('content-type'));
"
```

错误分支（缺 token、空 path）把 `nine-token` 参数去掉或把 `path` 置空即可覆盖。

### 查看改动

```bash
git status --short
git diff
git diff --check
```

### 部署后的最小 HTTP 合约检查

将 `<domain>` 和 `<NINE49TOKEN>` 替换为实际值；不要把真实 token 粘贴到共享日志、提交或文档中。测试重定向本身时用 `curl -i`，不要用 `-L` 自动跟随：

```bash
curl -i 'https://<domain>/?nine-token=<NINE49TOKEN>'
curl -i 'https://<domain>/octocat/Hello-World/master/README'
curl -i 'https://<domain>/octocat/Hello-World/master/README?nine-token=<NINE49TOKEN>'
```

预期分别是空路径错误跳转、缺少 token 的鉴权错误跳转，以及有效配置下的非错误状态、原始响应体和固定缓存头。第三条依赖网络、Vercel 部署和上游可用性。

## 修改与验证策略

- 先定位根因，再做最小 diff；保持现有命名、注释密度与模块边界。
- 修改鉴权、错误状态、重定向、缓存、响应头或流式转发时，必须同步核对 README 的对应章节。
- 修改 rewrite 时，必须验证 `path` 查询参数仍能正确到达 API。
- 行为变化至少运行 `pnpm run typecheck`、`pnpm run biome:check`，再用本地冒烟覆盖变化涉及的分支；可访问已部署环境时再跑对应 `curl` 合约检查。
- 本仓库不设自动化测试框架，不要为单次小改动引入测试基础设施；报告中明确说明哪些行为已本地验证、哪些仅静态检查。
- 流式转发是性能关键路径：`successResponse` 直接传上游 `ReadableStream`，不要退回 `arrayBuffer()`、`Buffer` 或 Node stream 适配。
- 任何新增日志字段都必须逐项检查是否可能包含秘密、完整输入或个人/网络标识。

## 部署与配置边界

部署目标是 Vercel。仓库没有构建步骤，入口配置在 `vercel.json`，运行时环境变量在 Vercel 项目设置中配置。环境变量名称、公开 URL 形状和 `nine-token` 查询参数名属于兼容性契约，除非任务明确要求迁移，否则不要重命名或改变语义。

## 当前限制

- 函数依赖 Vercel 的 Web 标准 Request/Response 支持（Node.js runtime 下的 fetch handler 形态）；本地 Node 24 可直接运行同签名代码做冒烟。
- 代理只实现固定的路径转发和少量头部白名单，不要未经明确需求扩展为通用 HTTP 代理。
- README 面向使用者，本文件面向未来 Agent；避免两处复制整段内容，分别维护各自需要的细节。
