/**
 * 应用配置常量
 * 集中管理所有配置项，便于维护和修改
 */

// GitHub 相关配置
export const GITHUB_CONFIG = {
  BASE_URL: "https://raw.githubusercontent.com",
  API_VERSION: "v3",
  TIMEOUT: 10000, // 10秒超时
};

// 安全相关配置
export const SECURITY_CONFIG = {
  REDIRECT_URL: "https://www.baidu.com",
  MAX_PATH_LENGTH: 1000,
  ALLOWED_FILE_TYPES: ["text", "image", "application", "audio", "video"],
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15分钟
    MAX_REQUESTS: 100, // 最多100个请求
  },
};

// 缓存配置
export const CACHE_CONFIG = {
  TTL: 300, // 5分钟缓存
  MAX_SIZE: 100, // 最多缓存100个条目
  KEY_PREFIX: "github_raw_",
};

// HTTP 状态码
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// 错误消息
export const ERROR_MESSAGES = {
  INVALID_TOKEN: "无效的访问令牌",
  INVALID_PATH: "无效的文件路径",
  GITHUB_ERROR: "GitHub API 访问错误",
  NETWORK_ERROR: "网络连接错误",
  TIMEOUT_ERROR: "请求超时",
  RATE_LIMIT_EXCEEDED: "请求频率超限",
};
