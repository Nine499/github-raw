/**
 * GitHub Raw 代理服务（Vercel）
 *
 * 目标：
 * 1) 用 nine-token 做最小鉴权
 * 2) 透传 GitHub Raw 的状态码和内容
 * 3) 使用 Vercel Edge Cache 提高命中率
 */
import { Buffer } from "node:buffer";

// 统一常量，避免魔法字符串分散在代码里
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const USER_AGENT = "Vercel-Github-Proxy";

export default async function handler(req, res) {
  // 读取服务端环境变量：访问令牌 + 可选 GitHub Token
  const { NINE49TOKEN, GITHUB49TOKEN } = process.env;

  // 解析请求 URL
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  // nine-token：访问鉴权参数
  const requestToken = requestUrl.searchParams.get("nine-token");

  // path：由 vercel rewrites 注入，去掉前导 / 避免拼接出双斜杠
  const rawPath = requestUrl.searchParams.get("path") || "";
  const githubPath = rawPath.replace(/^\/+/, "");

  // 鉴权失败：直接拒绝
  if (requestToken !== NINE49TOKEN) {
    return res.status(403).send("Forbidden");
  }

  // 缺少 path：直接返回请求参数错误
  if (!githubPath) {
    return res.status(400).send("Bad Request");
  }

  // 拼接上游 GitHub Raw 地址
  const upstreamUrl = `https://raw.githubusercontent.com/${githubPath}`;

  // 准备上游请求头
  const upstreamHeaders = {
    "User-Agent": USER_AGENT,
  };

  // 配置了 GITHUB49TOKEN 时，携带 Authorization 以提升可用性
  if (GITHUB49TOKEN) {
    upstreamHeaders.Authorization = `token ${GITHUB49TOKEN}`;
  }

  // 请求上游
  const upstreamResponse = await fetch(upstreamUrl, { headers: upstreamHeaders });

  // 状态码透传
  res.status(upstreamResponse.status);

  // 固定缓存策略：浏览器缓存 5 分钟，Edge 缓存 1 小时
  res.setHeader("Cache-Control", CACHE_CONTROL);

  // Content-Type 透传，缺失时降级为二进制类型
  const contentType =
    upstreamResponse.headers.get("content-type") || DEFAULT_CONTENT_TYPE;
  res.setHeader("Content-Type", contentType);

  // 统一按二进制返回，兼容文本、图片和其他文件
  const bodyBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
  return res.send(bodyBuffer);
}
