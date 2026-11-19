import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const RAW_BASE_URL = "https://raw.githubusercontent.com/";
const BAIDU_URL = "https://www.baidu.com/";
const USER_AGENT = "Vercel-Github-Proxy";
const FORWARDED_REQUEST_HEADERS = [
  "if-none-match",
  "if-modified-since",
  "range",
  "if-range",
];
const FORWARDED_RESPONSE_HEADERS = [
  "etag",
  "last-modified",
  "accept-ranges",
  "content-range",
];

function safePath(path) {
  return path.replace(/[\x00-\x1f\x7f]/g, "?").slice(0, 200) || "(empty)";
}

function logAccess(fields) {
  const message = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${value}`)
    .join(" ");
  console.log(`[github-raw] ${message}`);
}

function redirectError(res) {
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, BAIDU_URL);
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const { NINE49TOKEN, GITHUB49TOKEN } = process.env;
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const githubPath = (requestUrl.searchParams.get("path") || "").replace(
    /^\/+/, "",
  );
  const authToken = requestUrl.searchParams.get("nine-token");
  let authentication = "missing";
  if (!NINE49TOKEN) {
    authentication = "not-configured";
  } else if (authToken === NINE49TOKEN) {
    authentication = "valid";
  } else if (authToken) {
    authentication = "invalid";
  }
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

  const upstreamHeaders = { "User-Agent": USER_AGENT };

  if (GITHUB49TOKEN) {
    upstreamHeaders.Authorization = `token ${GITHUB49TOKEN}`;
  }

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers[name];
    if (value) {
      upstreamHeaders[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(`${RAW_BASE_URL}${githubPath}`, {
      headers: upstreamHeaders,
    });
  } catch {
    log("upstream-network-error", 302);
    return redirectError(res);
  }

  if (upstreamResponse.status >= 400) {
    log("upstream-error", 302, { upstreamStatus: upstreamResponse.status });
    return redirectError(res);
  }

  res.status(upstreamResponse.status);
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.setHeader(
    "Content-Type",
    upstreamResponse.headers.get("content-type") || DEFAULT_CONTENT_TYPE,
  );

  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(name);
    if (value) {
      res.setHeader(name, value);
    }
  }

  if (!upstreamResponse.body) {
    log("success", upstreamResponse.status, {
      upstreamStatus: upstreamResponse.status,
    });
    return res.end();
  }

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
