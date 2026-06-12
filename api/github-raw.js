import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const RAW_BASE_URL = "https://raw.githubusercontent.com/";
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

export default async function handler(req, res) {
  const { NINE49TOKEN, GITHUB49TOKEN } = process.env;
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const githubPath = (requestUrl.searchParams.get("path") || "").replace(
    /^\/+/,
    "",
  );

  if (!NINE49TOKEN || requestUrl.searchParams.get("nine-token") !== NINE49TOKEN) {
    return res.status(403).send("Forbidden");
  }

  if (!githubPath) {
    return res.status(400).send("Bad Request");
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
    return res.status(502).send("Bad Gateway");
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
    return res.end();
  }

  return pipeline(Readable.fromWeb(upstreamResponse.body), res);
}
