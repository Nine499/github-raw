/**
 * GitHub Raw 代理服务 - 精简版
 * 
 * 这是一个简单的 GitHub 文件代理服务，用于加速访问 GitHub 上的文件。
 * 
 * 主要功能：
 * 1. 令牌验证 - 保护服务不被滥用
 * 2. 速度限制 - 防止请求过于频繁
 * 3. 智能缓存 - 加快重复请求的响应速度
 * 4. 安全验证 - 防止恶意访问
 * 
 * 使用方法：
 * 访问：https://你的域名/owner/repo/branch/path?nine-token=你的令牌
 * 示例：https://你的域名/Nine499/github-raw/master/README.md?nine-token=abc123
 */

// ==================== 配置区域 ====================

// GitHub 相关配置
const GITHUB_BASE_URL = "https://raw.githubusercontent.com";
const REQUEST_TIMEOUT = 10000; // 10秒

// 安全相关配置
const REDIRECT_URL = "https://www.baidu.com";
const MAX_PATH_LENGTH = 1000;
const DANGEROUS_PATH_PATTERNS = [
  /\.\./, // 父目录符号
  /\/\//, // 双斜杠
  /^\//,  // 以斜杠开头
  /\/$/,  // 以斜杠结尾
];

// 缓存相关配置
const CACHE_TTL = 300; // 5分钟
const CACHE_MAX_SIZE = 100;

// 速度限制配置
const MAX_REQUESTS_PER_SECOND = 10;

// 文件类型白名单
const ALLOWED_FILE_TYPES = ["text", "image", "application", "audio", "video"];

// ==================== 速度限制器 ====================

const RATE_LIMIT_WINDOW_MS = 1000; // 1秒时间窗口

class RateLimiter {
  constructor(maxRequests = MAX_REQUESTS_PER_SECOND) {
    this.maxRequests = maxRequests;
    this.windowMs = RATE_LIMIT_WINDOW_MS;
    this.requests = [];
  }

  isAllowed() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 清理过期请求
    this.requests = this.requests.filter((time) => time > windowStart);

    // 检查是否超限
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
}

// ==================== 缓存系统 ====================

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  generateKey(path) {
    return `github_raw_${path}`;
  }

  set(key, value, ttl = CACHE_TTL) {
    // 清除旧定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 存储缓存
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // 设置过期定时器
    const timer = setTimeout(() => this.delete(key), ttl * 1000);
    this.timers.set(key, timer);

    // 检查缓存大小限制
    if (this.cache.size > CACHE_MAX_SIZE) {
      this.evictOldest();
    }
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > CACHE_TTL * 1000) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

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

// ==================== 全局实例 ====================
// 创建全局的速度限制器和缓存实例
const rateLimiter = new RateLimiter();
const cache = new SimpleCache();

// ==================== 工具函数 ====================

/**
 * 解析请求参数（兼容 WHATWG URL API 和 request.query）
 * @param {Object} request - Vercel 请求对象
 * @returns {Object} - 包含 userToken 和 githubPath 的对象
 */
function parseRequestParams(request) {
  // 使用 WHATWG URL API 解析请求 URL（避免触发 url.parse() 弃用警告）
  const requestUrl = new URL(request.url || '', `http://${request.headers.host}`);
  const userToken = requestUrl.searchParams.get('nine-token');
  const githubPath = requestUrl.searchParams.get('path');

  // 兼容 request.query（Vercel 可能已经解析了）
  return {
    userToken: userToken || request.query?.['nine-token'],
    githubPath: githubPath || request.query?.path,
  };
}

function validateToken(userToken, expectedToken) {
  if (!userToken || !expectedToken) {
    return false;
  }
  return userToken === expectedToken;
}

function validatePath(path) {
  if (!path || typeof path !== "string") {
    return false;
  }

  if (path.length > MAX_PATH_LENGTH) {
    return false;
  }

  // 路径格式：owner/repo/branch/path
  const pathPattern = /^[^\/]+\/[^\/]+\/[^\/]+\/.+$/;
  if (!pathPattern.test(path)) {
    return false;
  }

  // 检查危险模式
  return !DANGEROUS_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function sanitizePath(path) {
  if (!path) return "";
  return path.trim().replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

function validateFileType(contentType) {
  if (!contentType) return true;
  return ALLOWED_FILE_TYPES.some((type) =>
    contentType.toLowerCase().includes(type)
  );
}

// ==================== GitHub API 调用 ====================

/**
 * 从 GitHub 获取文件内容
 * @param {string} path - 文件路径（格式：owner/repo/branch/path）
 * @param {string} token - 可选的 GitHub 访问令牌
 * @returns {Promise<Object>} - 返回包含内容、类型或错误信息的对象
 */
async function fetchFromGitHub(path, token) {
  try {
    // 使用 WHATWG URL API 构建请求 URL（符合现代标准）
    const url = new URL(path, GITHUB_BASE_URL);
    
    const headers = {
      "User-Agent": "GitHub-Raw-Proxy/1.0",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API 错误: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    let content;

    if (contentType.includes("text/") || contentType.includes("application/json")) {
      content = await response.text();
    } else {
      const buffer = await response.arrayBuffer();
      content = Buffer.from(buffer).toString("base64");
    }

    return {
      success: true,
      content,
      contentType,
    };
  } catch (error) {
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

// ==================== 主处理函数 ====================

function redirectToSafePage(response) {
  return response.redirect(REDIRECT_URL);
}

function setCacheHeaders(response, cacheStatus, contentType) {
  response.setHeader("X-Cache", cacheStatus);
  response.setHeader("Cache-Control", `public, max-age=${CACHE_TTL}`);
  response.setHeader("Content-Type", contentType);
  
  // 跨域支持
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * 主处理函数
 * @param {Object} request - Vercel 请求对象
 * @param {Object} response - Vercel 响应对象
 */
export default async function handler(request, response) {
  const startTime = Date.now();

  try {
    // 解析请求参数
    const { userToken, githubPath } = parseRequestParams(request);

    // 验证必需参数
    if (!userToken) {
      console.warn("❌ 缺少令牌参数");
      return redirectToSafePage(response);
    }

    if (!githubPath) {
      console.warn("❌ 缺少路径参数");
      return redirectToSafePage(response);
    }

    // 验证令牌
    if (!validateToken(userToken, process.env.NINE49TOKEN)) {
      console.warn("❌ 令牌验证失败");
      return redirectToSafePage(response);
    }

    // 检查速度限制
    if (!rateLimiter.isAllowed()) {
      console.warn("❌ 请求频率超限");
      return redirectToSafePage(response);
    }

    // 清理和验证路径
    const sanitizedPath = sanitizePath(githubPath);
    if (!validatePath(sanitizedPath)) {
      console.warn("❌ 路径验证失败:", githubPath);
      return redirectToSafePage(response);
    }

    // 检查缓存
    const cacheKey = cache.generateKey(sanitizedPath);
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      console.info("✅ 缓存命中:", sanitizedPath);
      setCacheHeaders(response, "HIT", cachedResult.contentType);
      return response.status(200).send(cachedResult.content);
    }

    // 从 GitHub 获取文件
    console.info("📥 从 GitHub 获取:", sanitizedPath);
    const githubResult = await fetchFromGitHub(
      sanitizedPath,
      process.env.GITHUB49TOKEN
    );

    if (!githubResult.success) {
      console.error("❌ GitHub API 调用失败:", githubResult.error);
      return redirectToSafePage(response);
    }

    // 验证文件类型
    if (!validateFileType(githubResult.contentType)) {
      console.warn("❌ 不支持的文件类型:", githubResult.contentType);
      return redirectToSafePage(response);
    }

    // 缓存结果
    cache.set(cacheKey, githubResult);

    // 设置响应头
    setCacheHeaders(response, "MISS", githubResult.contentType);

    // 返回文件内容
    const duration = Date.now() - startTime;
    console.info("✅ 请求处理成功:", {
      path: sanitizedPath,
      duration: `${duration}ms`,
      cacheSize: cache.cache.size,
    });

    return response.status(200).send(githubResult.content);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ 请求处理异常:", error.message);
    console.error("   耗时:", `${duration}ms`);
    
    return redirectToSafePage(response);
  }
}

// ==================== 导出模块（用于测试） ====================
export { RateLimiter, SimpleCache, validateToken, validatePath, sanitizePath, validateFileType };
