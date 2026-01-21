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

// 调试开关：开发环境设为 true 可看到详细日志，生产环境设为 false
const DEBUG_MODE = process.env.NODE_ENV === "development";

// GitHub 相关配置
const GITHUB_BASE_URL = "https://raw.githubusercontent.com";
const REQUEST_TIMEOUT = 10000; // 10秒超时

// 安全相关配置
const REDIRECT_URL = "https://www.baidu.com";
const MAX_PATH_LENGTH = 1000;
const DANGEROUS_PATH_PATTERNS = [
  /\.\./, // 父目录符号（防止路径遍历攻击）
  /\/\//, // 双斜杠（防止路径混乱）
  /^\//,  // 以斜杠开头（防止绝对路径）
  /\/$/,  // 以斜杠结尾（防止无效路径）
];

// 缓存相关配置
// 缓存就像一个临时仓库，把经常访问的文件存起来，下次访问就不用再问 GitHub 了
const CACHE_TTL = 300; // 缓存有效期：5分钟（300秒）
const CACHE_MAX_SIZE = 100; // 缓存最大容量：100个文件

// 速度限制配置
const MAX_REQUESTS_PER_SECOND = 10;

// 文件类型白名单
const ALLOWED_FILE_TYPES = ["text", "image", "application", "audio", "video"];

// ==================== 速度限制器 ====================

const RATE_LIMIT_WINDOW_MS = 1000; // 1秒时间窗口

/**
 * 速度限制器 - 防止请求过于频繁
 * 就像限流阀，每秒最多允许通过 MAX_REQUESTS_PER_SECOND 个请求
 */
class RateLimiter {
  constructor(maxRequests = MAX_REQUESTS_PER_SECOND) {
    this.maxRequests = maxRequests;
    this.windowMs = RATE_LIMIT_WINDOW_MS;
    this.requests = [];
  }

  /**
   * 检查当前请求是否允许通过
   * @returns {boolean} - true 表示允许，false 表示超限
   */
  isAllowed() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 清理过期的请求记录（只保留最近1秒的）
    this.requests = this.requests.filter((time) => time > windowStart);

    // 检查是否超限
    if (this.requests.length >= this.maxRequests) {
      if (DEBUG_MODE) {
        console.warn(`⚠️ 速度限制触发：${this.requests.length}/${this.maxRequests} 请求/秒`);
      }
      return false;
    }

    // 记录当前请求
    this.requests.push(now);
    return true;
  }
}

// ==================== 缓存系统 ====================

/**
 * 简单缓存系统 - 提升响应速度
 * 
 * 工作原理：
 * 1. 第一次访问文件时，从 GitHub 获取并存入缓存
 * 2. 后续访问相同文件时，直接从缓存返回，速度更快
 * 3. 缓存会在 5 分钟后自动过期
 * 4. 缓存最多存储 100 个文件，超过后会删除最早的那个
 */
class SimpleCache {
  constructor() {
    this.cache = new Map(); // 存储缓存数据
    this.timers = new Map(); // 存储过期定时器
  }

  /**
   * 生成缓存键名
   * @param {string} path - 文件路径
   * @returns {string} - 缓存键名
   */
  generateKey(path) {
    return `github_raw_${path}`;
  }

  /**
   * 存入缓存
   * @param {string} key - 缓存键名
   * @param {*} value - 要缓存的数据
   * @param {number} ttl - 生存时间（秒）
   */
  set(key, value, ttl = CACHE_TTL) {
    // 清除旧的定时器（如果存在）
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 存储缓存数据
    this.cache.set(key, {
      value,      // 实际数据
      timestamp: Date.now(), // 存入时间
    });

    // 设置过期定时器（到达时间后自动删除）
    const timer = setTimeout(() => {
      if (DEBUG_MODE) {
        console.info(`🗑️ 缓存过期: ${key}`);
      }
      this.delete(key);
    }, ttl * 1000);
    this.timers.set(key, timer);

    // 检查缓存大小限制
    if (this.cache.size > CACHE_MAX_SIZE) {
      this.evictOldest();
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键名
   * @returns {*} - 缓存的数据，如果不存在或过期则返回 null
   */
  get(key) {
    const item = this.cache.get(key);

    // 缓存不存在
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > CACHE_TTL * 1000) {
      this.delete(key);
      return null;
    }

    // 返回缓存数据
    return item.value;
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键名
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * 淘汰最早的缓存（LRU 策略）
   * 当缓存满了时，删除最早存入的那个
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    // 遍历所有缓存，找到最早的那个
    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      if (DEBUG_MODE) {
        console.warn(`⚠️ 缓存已满，淘汰最早项: ${oldestKey}`);
      }
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
  const requestUrl = new URL(request.url || "", `http://${request.headers.host}`);
  const userToken = requestUrl.searchParams.get("nine-token");
  const githubPath = requestUrl.searchParams.get("path");

  // 兼容 request.query（Vercel 可能已经解析了）
  return {
    userToken: userToken || request.query?.["nine-token"],
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

  // 健康检查端点：返回服务状态
  if (request.url === "/health" || request.url?.startsWith("/health?")) {
    const uptime = process.uptime(); // 服务运行时间（秒）
    const uptimeFormatted = formatUptime(uptime);

    const healthInfo = {
      status: "ok", // 服务状态
      uptime: uptimeFormatted, // 运行时间
      timestamp: new Date().toISOString(), // 当前时间
      version: "2026.01.21.140112", // 版本号
      cache: {
        size: cache.cache.size, // 缓存当前大小
        maxSize: CACHE_MAX_SIZE, // 缓存最大容量
        usage: `${cache.cache.size}/${CACHE_MAX_SIZE}`, // 缓存使用率
      },
      rateLimit: {
        maxRequests: MAX_REQUESTS_PER_SECOND, // 每秒最大请求数
        windowMs: RATE_LIMIT_WINDOW_MS, // 时间窗口（毫秒）
      },
      environment: process.env.NODE_ENV || "unknown", // 运行环境
    };

    response.setHeader("Content-Type", "application/json");
    return response.status(200).json(healthInfo);
  }

  /**
   * 格式化运行时间
   * @param {number} seconds - 运行时间（秒）
   * @returns {string} - 格式化后的时间字符串
   */
  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

    return parts.join(" ");
  }

  try {
    // 解析请求参数
    const { userToken, githubPath } = parseRequestParams(request);

    // 验证必需参数
    if (!userToken) {
      console.warn("❌ 缺少令牌参数: 请在 URL 中添加 ?nine-token=你的令牌");
      return redirectToSafePage(response);
    }

    if (!githubPath) {
      console.warn("❌ 缺少路径参数: 请在 URL 中添加 ?path=文件路径");
      return redirectToSafePage(response);
    }

    // 验证令牌
    if (!validateToken(userToken, process.env.NINE49TOKEN)) {
      console.warn("❌ 令牌验证失败: 令牌不正确，请检查环境变量 NINE49TOKEN");
      return redirectToSafePage(response);
    }

    // 检查速度限制
    if (!rateLimiter.isAllowed()) {
      console.warn("❌ 请求频率超限: 每秒最多 10 次请求，请稍后再试");
      return redirectToSafePage(response);
    }

    // 清理和验证路径
    const sanitizedPath = sanitizePath(githubPath);
    if (!validatePath(sanitizedPath)) {
      console.warn("❌ 路径验证失败:", githubPath);
      console.warn("   正确格式: owner/repo/branch/path");
      console.warn("   示例: Nine499/github-raw/master/README.md");
      return redirectToSafePage(response);
    }

    // 检查缓存
    const cacheKey = cache.generateKey(sanitizedPath);
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      const duration = Date.now() - startTime;
      console.info("✅ 缓存命中:", sanitizedPath, `(${duration}ms)`);
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
      if (DEBUG_MODE) {
        console.error("   详细信息:", githubResult.details);
      }
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
      cacheUsage: `${cache.cache.size}/${CACHE_MAX_SIZE}`,
    });

    return response.status(200).send(githubResult.content);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ 请求处理异常:", error.message);
    console.error("   耗时:", `${duration}ms`);
    
    if (DEBUG_MODE) {
      console.error("   错误堆栈:", error.stack);
    }
    
    return redirectToSafePage(response);
  }
}

// ==================== 导出模块（用于测试） ====================
export { RateLimiter, SimpleCache, validateToken, validatePath, sanitizePath, validateFileType };
