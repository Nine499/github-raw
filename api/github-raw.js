/**
 * ============================================
 * GitHub Raw 代理服务 - 新手友好版
 * ============================================
 *
 * 【功能说明】
 * 这个服务就像一个"快递中转站"，帮你从 GitHub 快速获取文件。
 *
 * 【工作流程】
 * 1. 用户访问 → 提供令牌和文件路径
 * 2. 验证令牌 → 确认你有权限使用
 * 3. 限流检查 → 防止请求太频繁（每秒最多 10 次）
 * 4. 查缓存 → 文件是否已经下载过？
 *   - 有缓存 → 直接返回（速度快）
 *   - 无缓存 → 从 GitHub 下载并存入缓存
 * 5. 返回结果 → 把文件内容给用户
 *
 * 【使用方法】
 * 访问：https://你的域名/owner/repo/branch/path?nine-token=你的令牌
 * 示例：https://你的域名/Nine499/github-raw/master/README.md?nine-token=abc123
 *
 * 【健康检查】
 * 访问 /health 查看服务状态
 */

// ============================================
// 第一部分：基础配置（所有常量放这里，方便修改）
// ============================================

// 调试模式：开发时设为 true 可以看到详细日志
const DEBUG_MODE = process.env.NODE_ENV === "development";

// GitHub 相关配置
const GITHUB_BASE_URL = "https://raw.githubusercontent.com";
const REQUEST_TIMEOUT = 10000; // 请求超时时间（10秒）

// 安全相关配置
const REDIRECT_URL = "https://www.baidu.com"; // 验证失败时跳转到这里
const MAX_PATH_LENGTH = 1000; // 文件路径最大长度

// 缓存配置（缓存就是"临时仓库"，存下已经下载过的文件）
const CACHE_TTL = 300; // 缓存有效期：5分钟（300秒）
const CACHE_MAX_SIZE = 100; // 最多缓存 100 个文件

// 限流配置（防止有人恶意频繁请求）
const MAX_REQUESTS_PER_SECOND = 10; // 每秒最多 10 次请求

// 文件类型白名单（只允许这些类型的文件通过）
const ALLOWED_FILE_TYPES = ["text", "image", "application", "audio", "video"];

// ============================================
// 第二部分：工具函数（纯函数，不依赖外部状态）
// ============================================

/**
 * 获取客户端IP地址
 * 支持代理环境（如Cloudflare、Vercel）
 */
function getClientIP(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfIP = request.headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfIP) {
    return cfIP;
  }
  return "unknown";
}

/**
 * 解析请求参数
 * 从 URL 中提取令牌和文件路径
 */
function parseRequestParams(request) {
  const requestUrl = new URL(
    request.url || "",
    `http://${request.headers.host}`,
  );
  const userToken = requestUrl.searchParams.get("nine-token");
  const githubPath = requestUrl.searchParams.get("path");

  return {
    userToken: userToken || request.query?.["nine-token"],
    githubPath: githubPath || request.query?.path,
  };
}

/**
 * 验证令牌是否正确
 * 就像检查"门票"是否有效
 */
function validateToken(userToken, expectedToken) {
  if (!userToken || !expectedToken) return false;
  return userToken === expectedToken;
}

/**
 * 验证文件路径是否安全
 * 防止恶意路径（如 ../etc/passwd）
 */
function validatePath(path) {
  if (!path || typeof path !== "string") return false;
  if (path.length > MAX_PATH_LENGTH) return false;

  // 路径格式必须是：owner/repo/branch/path
  const pathPattern = /^[^\/]+\/[^\/]+\/[^\/]+\/.+$/;
  if (!pathPattern.test(path)) return false;

  // 检查危险字符
  const dangerousPatterns = [/\.\./, /\/\//, /^\//, /\/$/];
  return !dangerousPatterns.some((pattern) => pattern.test(path));
}

/**
 * 清理路径（移除多余的斜杠）
 */
function sanitizePath(path) {
  if (!path) return "";
  return path.trim().replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

/**
 * 验证文件类型是否在白名单中
 */
function validateFileType(contentType) {
  if (!contentType) return true;
  return ALLOWED_FILE_TYPES.some((type) =>
    contentType.toLowerCase().includes(type),
  );
}

// ============================================
// 第三部分：核心类（缓存和限流）
// ============================================

/**
 * 简单缓存系统
 * 工作原理：
 * 1. 第一次下载文件 → 存入缓存
 * 2. 第二次访问 → 直接从缓存返回（速度快）
 * 3. 5分钟后 → 缓存自动过期
 */
class SimpleCache {
  constructor() {
    this.cache = new Map(); // 存储缓存数据：key → { value, timestamp }
    this.timers = new Map(); // 存储过期定时器：key → timer
  }

  /**
   * 生成缓存键名
   */
  generateKey(path) {
    return `github_raw_${path}`;
  }

  /**
   * 存入缓存
   */
  set(key, value, ttl = CACHE_TTL) {
    // 如果已有这个缓存，先清除旧的定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 存储数据
    this.cache.set(key, {
      value: value,
      timestamp: Date.now(), // 记录存入时间
    });

    // 设置过期定时器（ttl 秒后自动删除）
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);
    this.timers.set(key, timer);

    // 如果缓存满了，删除最早的一个
    if (this.cache.size > CACHE_MAX_SIZE) {
      this.evictOldest();
    }
  }

  /**
   * 获取缓存
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > CACHE_TTL * 1000) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * 删除缓存
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * 删除最早的缓存（当缓存满了时）
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    // 找到最早的那个缓存
    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}

/**
 * 速度限制器
 * 防止请求过于频繁（就像限流阀）
 */
class RateLimiter {
  constructor(maxRequests = MAX_REQUESTS_PER_SECOND) {
    this.maxRequests = maxRequests;
    this.windowMs = 1000; // 时间窗口：1秒
    this.requests = []; // 记录每个请求的时间戳
  }

  /**
   * 检查当前请求是否允许通过
   */
  isAllowed() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 只保留最近 1 秒的请求记录
    this.requests = this.requests.filter((time) => time > windowStart);

    // 如果超过限制，拒绝请求
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // 记录当前请求
    this.requests.push(now);
    return true;
  }
}

// ============================================
// 第四部分：GitHub API 调用
// ============================================

/**
 * 从 GitHub 下载文件
 */
async function fetchFromGitHub(path, token) {
  try {
    const url = new URL(path, GITHUB_BASE_URL);

    const headers = {
      "User-Agent": "GitHub-Raw-Proxy/1.0",
    };

    // 如果有 GitHub 令牌，添加认证头
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 发送请求（设置 10 秒超时）
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    // 如果请求失败
    if (!response.ok) {
      throw new Error(
        `GitHub API 错误: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    let content;

    // 根据文件类型决定如何读取内容
    if (
      contentType.includes("text/") ||
      contentType.includes("application/json")
    ) {
      content = await response.text(); // 文本文件
    } else {
      const buffer = await response.arrayBuffer();
      content = Buffer.from(buffer).toString("base64"); // 二进制文件转 base64
    }

    return {
      success: true,
      content,
      contentType,
    };
  } catch (error) {
    // 判断错误类型
    let errorMessage = "GitHub API 访问错误";
    if (error.name === "AbortError") {
      errorMessage = "请求超时";
    } else if (error.name === "TypeError" && error.message.includes("fetch")) {
      errorMessage = "网络连接错误";
    }

    return {
      success: false,
      error: errorMessage,
      details: error.message,
    };
  }
}

// ============================================
// 第五部分：响应处理
// ============================================

/**
 * 跳转到安全页面（验证失败时）
 */
function redirectToSafePage(response) {
  return response.redirect(REDIRECT_URL);
}

/**
 * 设置缓存和 CORS 响应头
 */
function setCacheHeaders(response, cacheStatus, contentType) {
  response.setHeader("X-Cache", cacheStatus); // 告诉用户是否命中缓存
  response.setHeader("Cache-Control", `public, max-age=${CACHE_TTL}`);
  response.setHeader("Content-Type", contentType);

  // 允许跨域访问
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ============================================
// 第六部分：主处理函数（入口）
// ============================================

// 创建全局实例
const rateLimiter = new RateLimiter();
const cache = new SimpleCache();

/**
 * 主处理函数
 * 每次请求都会调用这个函数
 */
export default async function handler(request, response) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  // ========================================
  // 步骤 1：健康检查（查看服务状态）
  // ========================================
  if (request.url === "/health" || request.url?.startsWith("/health?")) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const uptimeFormatted = `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`;

    const healthInfo = {
      status: "ok",
      uptime: uptimeFormatted,
      timestamp: new Date().toISOString(),
      version: "2026.01.24.094012",
      cache: {
        size: cache.cache.size,
        maxSize: CACHE_MAX_SIZE,
        usage: `${cache.cache.size}/${CACHE_MAX_SIZE}`,
      },
      rateLimit: {
        maxRequests: MAX_REQUESTS_PER_SECOND,
        windowMs: 1000,
      },
      environment: process.env.NODE_ENV || "unknown",
    };

    response.setHeader("Content-Type", "application/json");
    return response.status(200).json(healthInfo);
  }

  // ========================================
  // 步骤 2：解析请求参数
  // ========================================
  const { userToken, githubPath } = parseRequestParams(request);

  // 检查令牌是否存在
  if (!userToken) {
    console.warn(
      `❌ IP ${clientIP} 缺少令牌参数: 请在 URL 中添加 ?nine-token=你的令牌`,
    );
    return redirectToSafePage(response);
  }

  // 检查路径是否存在
  if (!githubPath) {
    console.warn(
      `❌ IP ${clientIP} 缺少路径参数: 请在 URL 中添加 ?path=文件路径`,
    );
    return redirectToSafePage(response);
  }

  // ========================================
  // 步骤 3：验证令牌
  // ========================================
  if (!validateToken(userToken, process.env.NINE49TOKEN)) {
    console.warn(`❌ IP ${clientIP} 令牌验证失败: 令牌不正确`);
    return redirectToSafePage(response);
  }

  // ========================================
  // 步骤 4：限流检查
  // ========================================
  if (!rateLimiter.isAllowed()) {
    console.warn(`❌ IP ${clientIP} 请求频率超限: 每秒最多 10 次`);
    return redirectToSafePage(response);
  }

  // ========================================
  // 步骤 5：验证路径
  // ========================================
  const sanitizedPath = sanitizePath(githubPath);
  if (!validatePath(sanitizedPath)) {
    console.warn(`❌ IP ${clientIP} 路径验证失败:`, githubPath);
    console.warn("   正确格式: owner/repo/branch/path");
    console.warn("   示例: Nine499/github-raw/master/README.md");
    return redirectToSafePage(response);
  }

  // ========================================
  // 步骤 6：检查缓存
  // ========================================
  const cacheKey = cache.generateKey(sanitizedPath);
  const cachedResult = cache.get(cacheKey);

  if (cachedResult) {
    const duration = Date.now() - startTime;
    console.info(
      `✅ IP ${clientIP} 缓存命中:`,
      sanitizedPath,
      `(${duration}ms)`,
    );
    setCacheHeaders(response, "HIT", cachedResult.contentType);
    return response.status(200).send(cachedResult.content);
  }

  // ========================================
  // 步骤 7：从 GitHub 下载文件
  // ========================================
  console.info(`📥 IP ${clientIP} 从 GitHub 获取:`, sanitizedPath);
  const githubResult = await fetchFromGitHub(
    sanitizedPath,
    process.env.GITHUB49TOKEN,
  );

  if (!githubResult.success) {
    console.error("❌ GitHub API 调用失败:", githubResult.error);
    if (DEBUG_MODE) {
      console.error("   详细信息:", githubResult.details);
    }
    return redirectToSafePage(response);
  }

  // ========================================
  // 步骤 8：验证文件类型
  // ========================================
  if (!validateFileType(githubResult.contentType)) {
    console.warn("❌ 不支持的文件类型:", githubResult.contentType);
    return redirectToSafePage(response);
  }

  // ========================================
  // 步骤 9：存入缓存
  // ========================================
  cache.set(cacheKey, githubResult);

  // ========================================
  // 步骤 10：返回结果
  // ========================================
  setCacheHeaders(response, "MISS", githubResult.contentType);

  const duration = Date.now() - startTime;
  console.info(`✅ IP ${clientIP} 请求处理成功:`, {
    path: sanitizedPath,
    duration: `${duration}ms`,
    cacheSize: cache.cache.size,
  });

  return response.status(200).send(githubResult.content);
}

// ============================================
// 第七部分：导出（用于测试）
// ============================================
export {
  RateLimiter,
  SimpleCache,
  validateToken,
  validatePath,
  sanitizePath,
  validateFileType,
  getClientIP,
};
