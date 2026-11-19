/**
 * GitHub Raw 代理：唯一业务函数（单文件、零依赖，勿拆模块）。
 *
 * 请求链路：解析 path 与 nine-token → 恒定时间鉴权 → 请求 GitHub Raw →
 * 非错误响应流式透传，其余一切失败统一 302 到固定地址。
 * 对外契约见 README.md；行为不变量与改造红线见 AGENTS.md。
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/* ---------------- 固定常量（对外契约，改动须同步 README 与 CLAUDE.md） ---------------- */

const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const RAW_BASE_URL = "https://raw.githubusercontent.com/";
const ERROR_REDIRECT_URL = "https://www.baidu.com/";
const USER_AGENT = "Vercel-Github-Proxy";

/** 只转发协商缓存与范围请求相关的客户端请求头，其余一律不给上游。 */
const FORWARDED_REQUEST_HEADERS = [
  "if-none-match",
  "if-modified-since",
  "range",
  "if-range",
];

/** 只透传白名单内的上游响应头，避免暴露上游实现细节。 */
const FORWARDED_RESPONSE_HEADERS = [
  "etag",
  "last-modified",
  "accept-ranges",
  "content-range",
];

/* ---------------- 工具函数 ---------------- */

/**
 * 鉴权四分类：missing / not-configured / invalid / valid。
 * 服务端令牌未配置时一律拒绝，不会开放匿名访问；
 * 提供了令牌时用恒定时间比较，只完全匹配才是 valid。
 */
function classifyAuthentication(requestToken, serverToken) {
  if (!serverToken) {
    return "not-configured";
  }
  if (!requestToken) {
    return "missing";
  }
  return tokensEqual(requestToken, serverToken) ? "valid" : "invalid";
}

/** 恒定时间比较令牌，防止按响应耗时逐位猜测；勿改回 ===。 */
function tokensEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 组装上游请求头：固定 UA、可选 GitHub token、白名单客户端头。 */
function buildUpstreamHeaders(clientHeaders, githubToken) {
  const headers = { "User-Agent": USER_AGENT };

  if (githubToken) {
    headers.Authorization = `token ${githubToken}`;
  }

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = clientHeaders[name];
    if (value) {
      headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  return headers;
}

/** 写入成功响应：透传状态码、固定缓存、Content-Type 与白名单响应头。 */
function writeSuccessHeaders(res, upstream) {
  res.status(upstream.status);
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") || DEFAULT_CONTENT_TYPE,
  );

  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      res.setHeader(name, value);
    }
  }
}

/** 固定 302 错误跳转：Location 不携带任何原始输入，且禁止缓存。 */
function redirectError(res) {
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, ERROR_REDIRECT_URL);
}

/** 控制字符替换为问号并截断，避免日志注入与超长行。 */
function safePath(path) {
  return path.replace(/[\x00-\x1f\x7f]/g, "?").slice(0, 200) || "(empty)";
}

/** 脱敏访问摘要：只记录可安全公开的字段，一行一条。 */
function logAccess(fields) {
  const message = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${value}`)
    .join(" ");
  console.log(`[github-raw] ${message}`);
}

/* ---------------- 请求入口 ---------------- */

export default async function handler(req, res) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const { NINE49TOKEN, GITHUB49TOKEN } = process.env;

  // rewrite 注入的 path 与客户端的 nine-token 都在查询串里；
  // 只读查询参数，base 随意填一个合法值即可。
  const requestUrl = new URL(req.url, "http://github-raw.local");
  const githubPath = (requestUrl.searchParams.get("path") || "").replace(
    /^\/+/,
    "",
  );
  const authentication = classifyAuthentication(
    requestUrl.searchParams.get("nine-token"),
    NINE49TOKEN,
  );

  const log = (outcome, responseStatus, details = {}) =>
    logAccess({
      requestId,
      method: req.method || "UNKNOWN",
      path: safePath(githubPath),
      pathLength: githubPath.length,
      authentication,
      outcome,
      responseStatus,
      durationMs: Date.now() - startedAt,
      ...details,
    });

  if (authentication !== "valid") {
    log("authentication-rejected", 302);
    return redirectError(res);
  }

  if (!githubPath) {
    log("path-rejected", 302);
    return redirectError(res);
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(`${RAW_BASE_URL}${githubPath}`, {
      headers: buildUpstreamHeaders(req.headers, GITHUB49TOKEN),
    });
  } catch {
    log("upstream-network-error", 302);
    return redirectError(res);
  }

  if (upstreamResponse.status >= 400) {
    log("upstream-error", 302, { upstreamStatus: upstreamResponse.status });
    return redirectError(res);
  }

  writeSuccessHeaders(res, upstreamResponse);

  if (!upstreamResponse.body) {
    log("success", upstreamResponse.status, {
      upstreamStatus: upstreamResponse.status,
    });
    return res.end();
  }

  // 流式转发：边收边发，不整包读入内存。
  // 响应头已写出，此处失败只能记录，不能再发第二个响应。
  try {
    await pipeline(Readable.fromWeb(upstreamResponse.body), res);
    log("success", upstreamResponse.status, {
      upstreamStatus: upstreamResponse.status,
    });
  } catch {
    log("response-stream-error", upstreamResponse.status, {
      upstreamStatus: upstreamResponse.status,
    });
  }
}
