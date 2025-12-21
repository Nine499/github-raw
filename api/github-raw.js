/**
 * GitHub Raw 代理服务 - 优化版本
 * 单文件实现，包含速度限制和缓存功能
 */

// ===== 配置常量 =====
const GITHUB_CONFIG = {
  BASE_URL: "https://raw.githubusercontent.com",
  TIMEOUT: 10000, // 10秒超时
};

const SECURITY_CONFIG = {
  REDIRECT_URL: "https://www.baidu.com",
  MAX_PATH_LENGTH: 1000,
  ALLOWED_FILE_TYPES: ["text", "image", "application", "audio", "video"],
};

const CACHE_CONFIG = {
  TTL: 300, // 5分钟缓存
  MAX_SIZE: 100, // 最多缓存100个条目
  KEY_PREFIX: "github_raw_",
};

const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: 10, // 每秒最多10次请求
  WINDOW_MS: 1000, // 1秒窗口
};

const ERROR_MESSAGES = {
  INVALID_TOKEN: "无效的访问令牌",
  INVALID_PATH: "无效的文件路径",
  GITHUB_ERROR: "GitHub API 访问错误",
  NETWORK_ERROR: "网络连接错误",
  TIMEOUT_ERROR: "请求超时",
  RATE_LIMIT_EXCEEDED: "请求频率超限",
};

// ===== 速度限制器 =====
class RateLimiter {
  constructor(
    maxRequests = RATE_LIMIT_CONFIG.MAX_REQUESTS,
    windowMs = RATE_LIMIT_CONFIG.WINDOW_MS
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
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

    // 记录当前请求
    this.requests.push(now);
    return true;
  }

  getStats() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const recentRequests = this.requests.filter((time) => time > windowStart);

    return {
      current: recentRequests.length,
      max: this.maxRequests,
      windowMs: this.windowMs,
      resetTime: this.requests.length > 0 ? Math.max(...this.requests) + this.windowMs : now + this.windowMs,
    };
  }
}

// ===== 简单缓存实现 =====
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  generateKey(path, token = "") {
    const tokenHash = token ? this.simpleHash(token) : "";
    return `${CACHE_CONFIG.KEY_PREFIX}${path}:${tokenHash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  set(key, value, ttl = CACHE_CONFIG.TTL) {
    // 如果已存在，先清除旧定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 设置缓存
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000,
    });

    // 设置过期定时器
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);

    // 检查缓存大小限制
    if (this.cache.size > CACHE_CONFIG.MAX_SIZE) {
      this.evictOldest();
    }
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
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

  getStats() {
    return {
      size: this.cache.size,
      maxSize: CACHE_CONFIG.MAX_SIZE,
    };
  }
}

// ===== 全局实例 =====
const rateLimiter = new RateLimiter();
const cache = new SimpleCache();

// ===== 工具函数 =====
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

  if (path.length > SECURITY_CONFIG.MAX_PATH_LENGTH) {
    return false;
  }

  // 检查路径格式：owner/repo/branch/path
  const pathPattern = /^[^\/]+\/[^\/]+\/[^\/]+\/.+$/;
  if (!pathPattern.test(path)) {
    return false;
  }

  // 检查是否包含危险字符
  const dangerousPatterns = [
    /\.\./, // 目录遍历
    /\/\//, // 双斜杠
    /^\//, // 以斜杠开头
    /\/$/, // 以斜杠结尾
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(path));
}

function sanitizePath(path) {
  if (!path) return "";
  return path.trim().replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

function validateFileType(contentType) {
  if (!contentType) return true;
  return SECURITY_CONFIG.ALLOWED_FILE_TYPES.some((type) =>
    contentType.toLowerCase().includes(type)
  );
}

function validateRequest(query) {
  const errors = [];

  if (!query["nine-token"]) {
    errors.push(ERROR_MESSAGES.INVALID_TOKEN);
  }

  if (!query.path) {
    errors.push(ERROR_MESSAGES.INVALID_PATH);
  }

  if (query.path && !validatePath(query.path)) {
    errors.push(ERROR_MESSAGES.INVALID_PATH);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ===== GitHub API 服务 =====
async function fetchFile(path, token) {
  try {
    const url = `${GITHUB_CONFIG.BASE_URL}/${path}`;
    const headers = {
      "User-Agent": "GitHub-Raw-Proxy/1.0",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(GITHUB_CONFIG.TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API 错误: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    let content;

    if (contentType.includes("application/json")) {
      content = await response.text();
    } else if (contentType.includes("text/")) {
      content = await response.text();
    } else {
      const buffer = await response.arrayBuffer();
      content = Buffer.from(buffer).toString("base64");
    }

    return {
      success: true,
      content,
      contentType,
      status: response.status,
    };
  } catch (error) {
    let errorMessage = ERROR_MESSAGES.GITHUB_ERROR;

    if (error.name === "AbortError") {
      errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR;
    } else if (error.name === "TypeError" && error.message.includes("fetch")) {
      errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
    }

    return {
      success: false,
      error: errorMessage,
      details: error.message,
    };
  }
}

// ===== 错误处理 =====
function handleRateLimit(response) {
  const stats = rateLimiter.getStats();
  console.warn("速度限制触发", stats);
  return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
}

function handleError(response, error) {
  console.error("请求处理错误", error);
  return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
}

// ===== 主处理函数 =====
export default async function handler(request, response) {
  const startTime = Date.now();

  try {
    // 验证请求参数
    const validation = validateRequest(request.query);
    if (!validation.isValid) {
      console.warn("请求验证失败", { errors: validation.errors });
      return handleError(response, { errors: validation.errors });
    }

    // 提取参数
    const { "nine-token": userToken, path: githubPath } = request.query;

    // 验证用户令牌
    if (!validateToken(userToken, process.env.NINE49TOKEN)) {
      console.warn("令牌验证失败", {
        providedToken: userToken ? "[REDACTED]" : "missing",
      });
      return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
    }

    // 速度限制检查
    if (!rateLimiter.isAllowed()) {
      return handleRateLimit(response);
    }

    // 清理和验证路径
    const sanitizedPath = sanitizePath(githubPath);
    if (!validatePath(sanitizedPath)) {
      console.warn("路径验证失败", { originalPath: githubPath });
      return handleError(response, { error: ERROR_MESSAGES.INVALID_PATH });
    }

    // 检查缓存
    const cacheKey = cache.generateKey(
      sanitizedPath,
      process.env.GITHUB49TOKEN
    );
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      console.info("缓存命中", { path: sanitizedPath });

      response.setHeader("X-Cache", "HIT");
      response.setHeader(
        "Cache-Control",
        `public, max-age=${CACHE_CONFIG.TTL}`
      );

      if (cachedResult.contentType) {
        response.setHeader("Content-Type", cachedResult.contentType);
      }

      response.status(200).send(cachedResult.content);

      const duration = Date.now() - startTime;
      console.info("缓存响应成功", {
        path: sanitizedPath,
        duration: `${duration}ms`,
      });

      return;
    }

    // 缓存未命中，获取 GitHub 文件内容
    const githubResult = await fetchFile(
      sanitizedPath,
      process.env.GITHUB49TOKEN
    );

    if (!githubResult.success) {
      console.error("GitHub API 调用失败", githubResult.error, {
        path: sanitizedPath,
      });
      return handleError(response, githubResult);
    }

    // 验证文件类型
    if (!validateFileType(githubResult.contentType)) {
      console.warn("不支持的文件类型", {
        path: sanitizedPath,
        contentType: githubResult.contentType,
      });
      return handleError(response, { error: "不支持的文件类型" });
    }

    // 缓存成功的结果
    cache.set(cacheKey, githubResult);

    // 设置响应头
    response.setHeader("X-Cache", "MISS");
    response.setHeader("Cache-Control", `public, max-age=${CACHE_CONFIG.TTL}`);

    if (githubResult.contentType) {
      response.setHeader("Content-Type", githubResult.contentType);
    }

    // 添加跨域头
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // 返回文件内容
    response.status(200).send(githubResult.content);

    // 记录成功日志
    const duration = Date.now() - startTime;
    console.info("请求处理成功", {
      path: sanitizedPath,
      duration: `${duration}ms`,
      cacheStats: cache.getStats(),
      rateLimitStats: rateLimiter.getStats(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("请求处理异常", error, {
      duration: `${duration}ms`,
      query: request.query,
    });

    handleError(response, error);
  }
}
