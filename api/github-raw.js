// Version: 2026.02.27.161447
/**
 * GitHub Raw 代理服务（极简直通）
 *
 * 设计目标：
 * - 保留最小必要鉴权（nine-token）
 * - 删除特殊路由与兜底重定向
 * - 透传 GitHub Raw 状态码与内容
 * - 使用 Edge Cache 提升静态内容命中率
 */
import { Buffer } from "node:buffer";

export default async function handler(req, res) {
  // 读取环境变量：访问令牌与可选 GitHub Token
  const { NINE49TOKEN, GITHUB49TOKEN } = process.env;

  // 解析请求参数，path 去除前导斜杠避免双斜杠拼接
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("nine-token");
  const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");

  // 鉴权失败直接拒绝
  if (token !== NINE49TOKEN) {
    return res.status(403).send("Forbidden");
  }

  // 缺少路径直接返回请求错误
  if (!path) {
    return res.status(400).send("Bad Request");
  }

  // 构造 GitHub Raw 目标地址
  const githubUrl = `https://raw.githubusercontent.com/${path}`;

  // 仅在配置了 GITHUB49TOKEN 时附带 Authorization
  const headers = {
    "User-Agent": "Vercel-Github-Proxy",
  };
  if (GITHUB49TOKEN) {
    headers.Authorization = `token ${GITHUB49TOKEN}`;
  }

  // 请求上游并透传状态码
  const response = await fetch(githubUrl, { headers });
  res.status(response.status);

  // 统一缓存策略：浏览器 5 分钟，Edge 1 小时
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");

  // 保留上游内容类型，缺失时回落为通用二进制类型
  res.setHeader(
    "Content-Type",
    response.headers.get("content-type") || "application/octet-stream",
  );

  // 统一二进制透传，兼容文本/图片/任意文件
  const buffer = Buffer.from(await response.arrayBuffer());
  return res.send(buffer);
}
