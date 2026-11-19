# GitHub Raw 代理（Vercel）

一个部署在 [Vercel](https://vercel.com/) 上的轻量 GitHub Raw 文件代理。访问者使用项目配置的令牌请求一个 GitHub 仓库文件，服务端向 `raw.githubusercontent.com` 获取文件，再以原始响应体返回。

它适合把 GitHub Raw 文件放到一个自有域名下，并统一增加访问令牌与缓存策略。项目刻意保持极简：没有前端、没有数据库、没有依赖、没有构建步骤，整个代理就是一个函数文件。

## 快速开始

**部署上线（三步）**：

1. 将本仓库推送到你有权使用的 Git 仓库，在 Vercel 中 **Add New → Project** 导入，保持默认的无构建部署方式（本项目没有 build 命令）。
2. 在 **Settings → Environment Variables** 配置环境变量（见下表），然后部署。
3. 部署完成后即可使用：

   ```text
   https://<你的域名>/<owner>/<repo>/<branch>/<file-path>?nine-token=<NINE49TOKEN>
   ```

**环境变量**：

| 变量名          | 是否必填 | 用途                                                                 |
| --------------- | -------- | -------------------------------------------------------------------- |
| `NINE49TOKEN`   | 必填     | 代理入口令牌；请求中的 `nine-token` 必须与它完全一致                  |
| `GITHUB49TOKEN` | 可选     | 请求 GitHub Raw 时使用的 GitHub token，可提高受限流量场景下的可用性    |

环境变量修改后，需按 Vercel 的规则重新部署或使新部署生效。令牌应只放在 Vercel 环境变量中，不要写入仓库文件、URL 示例的真实值、提交信息或公开日志。

如果没有配置 `NINE49TOKEN`，任何请求都会被拒绝并重定向；服务不会因此开放匿名访问。

## 目录

- [工作原理](#工作原理)
- [发送请求](#发送请求)
- [响应与错误行为](#响应与错误行为)
- [缓存与请求头](#缓存与请求头)
- [日志与隐私](#日志与隐私)
- [本地检查与开发](#本地检查与开发)
- [项目文件](#项目文件)
- [限制与注意事项](#限制与注意事项)
- [许可证](#许可证)

## 工作原理

请求链路如下：

```text
客户端
  │  GET /<owner>/<repo>/<branch>/<file-path>?nine-token=...
  ▼
Vercel rewrite（透明转发，地址栏不变）
  │  /api/github-raw.js?path=<原始路径>
  ▼
api/github-raw.js（唯一函数）
  │  校验 nine-token（恒定时间比较）
  │  可选地携带 GITHUB49TOKEN 请求 GitHub
  ▼
https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<file-path>
  │
  └─ 非错误响应：状态码、允许的响应头和原始流式响应体返回给客户端
```

`vercel.json` 中的两条路由规则：

```text
/        →  302 跳转 https://www.baidu.com/   （redirect，裸根路径）
/:path*  →  /api/github-raw.js?path=:path*    （rewrite，其余全部路径）
```

裸根路径单独用 redirect 处理：Vercel 在 rewrite 之前会先对 `/` 做静态文件查找，本项目没有任何静态输出，`/` 会直接 404 且永远到不了函数；redirect 的优先级高于静态查找，把根路径固定 302 到百度，与函数内部的错误跳转保持同一行为。

因此 URL 中的仓库路径不需要写成 `path` 查询参数；`path` 是 Vercel 在内部注入的参数，客户端自带的查询参数（如 `nine-token`）会原样保留。

## 发送请求

### URL 格式

```text
https://<你的域名>/<owner>/<repo>/<branch>/<file-path>?nine-token=<NINE49TOKEN>
```

- `<你的域名>`：Vercel 分配的域名，或绑定到项目的自定义域名。
- `<owner>`：GitHub 用户名或组织名。
- `<repo>`：仓库名。
- `<branch>`：分支名、tag 或其他 GitHub Raw 支持的引用。
- `<file-path>`：仓库内文件路径；可以包含多级目录。
- `nine-token`：代理访问令牌，值必须与 `NINE49TOKEN` 完全一致。

### 示例

```text
https://your-app.vercel.app/octocat/Hello-World/master/README?nine-token=YOUR_TOKEN
```

对应的上游地址是：

```text
https://raw.githubusercontent.com/octocat/Hello-World/master/README
```

`YOUR_TOKEN` 只是占位符，不是可用令牌；实际使用时应通过安全方式提供真实值。文件路径包含空格、`#`、`?` 等特殊字符时应按 URL 规则编码。

### curl 示例

查看响应头但不自动跟随错误重定向：

```bash
curl -i 'https://your-app.vercel.app/octocat/Hello-World/master/README?nine-token=YOUR_TOKEN'
```

下载文件内容：

```bash
curl --fail --location \
  'https://your-app.vercel.app/octocat/Hello-World/master/README?nine-token=YOUR_TOKEN' \
  --output README
```

调试错误行为时去掉 `--location`，直接观察 `302` 和 `Location` 响应头。

## 响应与错误行为

### 成功响应

当令牌有效、路径非空，且 GitHub Raw 返回的状态码小于 `400` 时：

- 透传上游状态码，例如 `200` 或 `206`。
- 响应体以流式方式转发（边收边发），不包装 JSON，不改变文本、图片或二进制内容。
- 透传上游 `Content-Type`；上游缺失时使用 `application/octet-stream`。
- 按白名单透传 `ETag`、`Last-Modified`、`Accept-Ranges`、`Content-Range`。
- 固定缓存头：

  ```text
  Cache-Control: public, max-age=300, s-maxage=3600
  ```

### 错误响应

以下情况返回 `302` 并跳转到固定地址。其中裸根路径由 `vercel.json` 的 redirect 在路由层处理，其余由函数处理并记录访问摘要：

| 情况                               | 结果                             |
| ---------------------------------- | -------------------------------- |
| 裸根路径 `/`（路由层 redirect）    | `302` → `https://www.baidu.com/` |
| `nine-token` 缺失或不正确          | `302` → `https://www.baidu.com/` |
| `NINE49TOKEN` 未配置               | `302` → `https://www.baidu.com/` |
| `path` 为空                        | `302` → `https://www.baidu.com/` |
| 请求 GitHub Raw 时发生网络错误     | `302` → `https://www.baidu.com/` |
| GitHub Raw 返回 `400` 或更高状态码 | `302` → `https://www.baidu.com/` |

错误重定向的 `Location` 始终是固定百度地址，不包含原始路径、查询参数或任何令牌；错误响应使用 `Cache-Control: no-store`。

代理不会把上游 `4xx`/`5xx` 状态码或错误正文直接交给客户端。不会自动跟随重定向的客户端将看到 `302`；会自动跟随的客户端最终会访问固定地址。

## 缓存与请求头

代理固定设置：

- 浏览器缓存最多 300 秒（5 分钟）。
- Vercel Edge Cache 可缓存 3600 秒（1 小时）。

为支持协商缓存和范围请求，代理只向上游转发这些客户端请求头：

- `If-None-Match`
- `If-Modified-Since`
- `Range`
- `If-Range`

代理始终发送固定的 `User-Agent`。配置 `GITHUB49TOKEN` 时，还会向 GitHub Raw 发送 `Authorization`。该认证头不会返回给客户端，也不会写入运行日志。

响应头采用白名单策略，不会无条件复制 GitHub 的全部响应头，减少暴露上游实现细节的范围；新增头部前必须评估缓存、隐私和兼容性影响。

## 日志与隐私

每次进入函数时，服务会尽力向 Vercel Runtime Logs 写入一条脱敏访问摘要，可能包含：

- `requestId`
- HTTP method
- 截断后的安全路径及路径长度
- 鉴权分类：`missing`、`not-configured`、`invalid` 或 `valid`
- 结果分类
- 客户端响应状态和上游状态（如有）
- 请求耗时

应用代码不会记录：

- `nine-token` 的值
- `NINE49TOKEN` 或 `GITHUB49TOKEN` 的值
- `Authorization`
- Cookie
- IP 地址
- 完整查询字符串
- 请求体或响应体

日志是“尽力记录”：Vercel 的保留策略、函数异常终止或平台不可用可能导致某条日志缺失或被截断。Vercel、浏览器和网络客户端仍可能显示请求域名、网络请求、响应状态和重定向链；应用日志不能彻底隐藏这些代理痕迹。

## 本地检查与开发

仓库没有 `package.json`，因此不存在 `npm run build` / `npm test` / `npm run lint` 等命令，本地开发只需 Node 本身。

### 语法与模块加载检查

```bash
node --check api/github-raw.js
node --input-type=module -e "await import('./api/github-raw.js')"
```

第一条检查语法，第二条确认 ES module 可以被 Node 加载。它们不会模拟 Vercel 请求，也不会发起上游请求。

### 行为冒烟（可选，会真实访问 GitHub Raw）

用一个基于 `node:stream` `Writable` 的假 `res` 驱动函数即可验证各分支（鉴权拒绝、空路径 → 302；有效请求 → 流式 200）：

```bash
NINE49TOKEN=testtoken node --input-type=module -e "
import { Writable } from 'node:stream';
const { default: handler } = await import('./api/github-raw.js');
function makeRes() {
  const res = new Writable({ write(chunk, enc, cb) { this.chunks.push(chunk); cb(); } });
  res.chunks = []; res._headers = {}; res.statusCode = 200;
  res.status = function (c) { this.statusCode = c; return this; };
  res.setHeader = function (n, v) { this._headers[n.toLowerCase()] = v; };
  res.redirect = function (c, l) { this.statusCode = c; this._headers.location = l; this.headersSent = true; this.end(); return this; };
  return res;
}
const req = { url: '/api/github-raw.js?path=octocat/Hello-World/master/README&nine-token=testtoken', method: 'GET', headers: {}, on() {} };
const res = makeRes();
await handler(req, res);
console.log('成功分支 →', res.statusCode, res._headers['content-type']);
const req2 = { url: '/api/github-raw.js?path=a/b', method: 'GET', headers: {}, on() {} };
const res2 = makeRes();
await handler(req2, res2);
console.log('错误分支 →', res2.statusCode, res2._headers.location);
"
```

预期输出两行：`成功分支 → 200 text/plain; charset=utf-8` 与 `错误分支 → 302 https://www.baidu.com/`。首次有效请求若因 GitHub Raw 网络波动返回 302，重试即可。

### 查看改动

```bash
git status --short
git diff -- api/github-raw.js README.md vercel.json
git diff --check
```

### 部署后合约检查

将占位符替换为实际域名和令牌；调试重定向时不要加 `-L`：

```bash
curl -i 'https://<domain>/?nine-token=<NINE49TOKEN>'
curl -i 'https://<domain>/octocat/Hello-World/master/README'
curl -i 'https://<domain>/octocat/Hello-World/master/README?nine-token=<NINE49TOKEN>'
```

预期分别是裸根路径 302 跳转（`vercel.json` 的 redirect）、缺少 token 的鉴权错误跳转，以及在有效配置下的非错误状态、原始响应体和固定缓存头。第三条依赖网络、Vercel 部署和上游仓库可用。

## 项目文件

```text
.
├── api/
│   └── github-raw.js   # 整个代理：常量、工具函数与唯一 handler
├── vercel.json          # 全路径 rewrite：/ → /api/github-raw.js?path=:path*
├── CLAUDE.md            # 指向 AGENTS.md 的入口指针
├── AGENTS.md            # Agent 工程文档（单一事实源）
├── README.md            # 面向使用者的部署与接口说明
├── License              # 许可证文本
└── .gitignore           # Git 忽略规则
```

## 限制与注意事项

- 这是固定用途的 GitHub Raw 代理，不是通用 HTTP 代理；不要未经明确需求增加任意目标主机、任意方法或任意响应头转发。
- 性能关键路径是响应体流式转发（`Readable.fromWeb` + `pipeline`，边收边发）；不要改成 `arrayBuffer()`、`Buffer` 或其他整包读入方式。
- `path` 由 Vercel rewrite 注入。修改 rewrite、查询参数、环境变量、鉴权、状态码、重定向或缓存行为时，应同时更新相关代码和本文档。
- 本仓库没有自动化行为测试；行为变更应在条件允许时通过本地冒烟或已部署域名的 HTTP 合约检查验证，并如实区分本地验证与部署后验证。
- GitHub Raw 的可访问性、限流、仓库权限和上游响应内容由 GitHub 决定；`GITHUB49TOKEN` 只影响代理请求上游时的认证，不会改变代理入口令牌规则。
- 项目保持单文件、零依赖形态；不要为单次改动引入依赖管理文件、构建系统或模块拆分。

## 许可证

许可证文本位于仓库根目录的 `License` 文件中。

面向编程 Agent 的工程文档（架构、契约、红线）见 [AGENTS.md](AGENTS.md)。
