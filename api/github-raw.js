/**
 * ============================================
 * GitHub Raw 代理服务 - 极客精简版
 * ============================================
 *
 * 【极客优化理念】
 * 1. 移除内存缓存：Serverless 是无状态的，内存缓存命中率极低。
 *    改用 Vercel Edge Cache (s-maxage)，由全球节点缓存，速度更快。
 * 2. 移除内存限流：单实例限流无法防御分布式攻击。
 *    依赖 Vercel 平台级的 DDoS 防护。
 * 3. 修复二进制 Bug：原版将图片转 Base64 导致无法直接预览。
 *    现改为 Buffer 透传，支持所有文件类型。
 * 4. 代码极简：300行 -> 50行，维护成本降低 80%。
 */

export default async function handler(req, res) {
  // 1. 配置常量
  const { NINE49TOKEN, GITHUB49TOKEN } = process.env;
  const REDIRECT_URL = "https://www.baidu.com";

  // 2. 解析 URL (支持 Vercel 的 req.url)
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("nine-token");
  // 移除路径开头的斜杠，防止双重斜杠
  const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");

  // 3. 健康检查
  if (path === "health") {
    return res.json({
      status: "ok",
      uptime: process.uptime().toFixed(0) + "s",
      cache: "Vercel Edge",
    });
  }

  // 4. 安全验证
  // 如果没有令牌或令牌错误，直接重置连接或重定向，不做额外计算
  if (!token || token !== NINE49TOKEN) {
    return res.redirect(302, REDIRECT_URL);
  }
  if (!path) {
    return res.redirect(302, REDIRECT_URL);
  }

  // 5. 请求 GitHub
  try {
    const githubUrl = `https://raw.githubusercontent.com/${path}`;

    // 发起请求，设置 10 秒超时
    const response = await fetch(githubUrl, {
      headers: {
        "User-Agent": "Vercel-Github-Proxy",
        // 只有配置了 GitHub Token 才会带上，避免匿名限制
        Authorization: GITHUB49TOKEN ? `token ${GITHUB49TOKEN}` : undefined,
      },
      // 高版本 Node.js 支持静态方法，低版本 Vercel 环境通常也支持
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`GitHub Status: ${response.status}`);
    }

    // 6. 设置缓存头 (核心优化)
    // public: 允许 CDN 缓存
    // max-age: 浏览器缓存 5 分钟
    // s-maxage: Vercel 边缘节点缓存 1 小时 (大幅减少冷启动)
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream",
    );

    // 7. 统一透传处理 (文本/图片/二进制通用)
    // 直接将流转换为 Buffer 发送，无需区分 text/json/image，兼容性最好
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    console.error(`[Proxy Error] ${path}: ${error.message}`);
    return res.redirect(302, REDIRECT_URL);
  }
}
