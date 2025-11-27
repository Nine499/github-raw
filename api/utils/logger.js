/**
 * 日志工具
 * 提供统一的日志记录功能
 */

/**
 * 日志级别枚举
 */
export const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
};

/**
 * 日志记录器类
 */
export class Logger {
  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {Error|Object} error - 错误对象或详情
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static error(message, error = null, metadata = {}) {
    this.log(LOG_LEVELS.ERROR, message, { error, ...metadata });
  }

  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static warn(message, metadata = {}) {
    this.log(LOG_LEVELS.WARN, message, metadata);
  }

  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static info(message, metadata = {}) {
    this.log(LOG_LEVELS.INFO, message, metadata);
  }

  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static debug(message, metadata = {}) {
    // 只在开发环境记录调试日志
    if (process.env.NODE_ENV === "development") {
      this.log(LOG_LEVELS.DEBUG, message, metadata);
    }
  }

  /**
   * 记录请求日志
   * @param {Object} request - 请求对象
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static request(request, metadata = {}) {
    const requestData = {
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      ip: this.getClientIP(request),
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    this.info("HTTP 请求", requestData);
  }

  /**
   * 记录响应日志
   * @param {Object} response - 响应对象
   * @param {number} duration - 请求处理时间（毫秒）
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static response(response, duration, metadata = {}) {
    const responseData = {
      statusCode: response.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    this.info("HTTP 响应", responseData);
  }

  /**
   * 记录 API 调用日志
   * @param {string} api - API 名称
   * @param {Object} params - API 参数
   * @param {Object} result - API 结果
   * @param {number} duration - 调用时间（毫秒）
   * @returns {void}
   */
  static api(api, params, result, duration) {
    const apiData = {
      api,
      params: this.sanitizeParams(params),
      success: result.success,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    if (result.success) {
      this.info(`API 调用成功: ${api}`, apiData);
    } else {
      this.error(`API 调用失败: ${api}`, result.error, apiData);
    }
  }

  /**
   * 核心日志记录方法
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static log(level, message, metadata = {}) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // 格式化日志输出
    const formattedLog = this.formatLog(logEntry);

    // 根据日志级别选择输出方式
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(formattedLog);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formattedLog);
        break;
      case LOG_LEVELS.INFO:
        console.log(formattedLog);
        break;
      case LOG_LEVELS.DEBUG:
        console.debug(formattedLog);
        break;
      default:
        console.log(formattedLog);
    }

    // 在生产环境中，可以在这里集成外部日志服务
    if (process.env.NODE_ENV === "production") {
      this.sendToExternalLogger(logEntry);
    }
  }

  /**
   * 格式化日志输出
   * @param {Object} logEntry - 日志条目
   * @returns {string} 格式化后的日志字符串
   */
  static formatLog(logEntry) {
    const { level, message, timestamp, ...metadata } = logEntry;

    let formatted = `[${timestamp}] ${level}: ${message}`;

    // 添加元数据
    if (Object.keys(metadata).length > 0) {
      formatted += `\n${JSON.stringify(metadata, null, 2)}`;
    }

    return formatted;
  }

  /**
   * 获取客户端 IP 地址
   * @param {Object} request - 请求对象
   * @returns {string} 客户端 IP 地址
   */
  static getClientIP(request) {
    return (
      request.headers["x-forwarded-for"] ||
      request.headers["x-real-ip"] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      "unknown"
    );
  }

  /**
   * 清理敏感参数
   * @param {Object} params - 原始参数
   * @returns {Object} 清理后的参数
   */
  static sanitizeParams(params) {
    const sanitized = { ...params };
    const sensitiveKeys = ["token", "password", "key", "secret"];

    for (const key of Object.keys(sanitized)) {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        sanitized[key] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  /**
   * 发送日志到外部日志服务
   * @param {Object} logEntry - 日志条目
   * @returns {void}
   */
  static async sendToExternalLogger(logEntry) {
    // 这里可以集成外部日志服务，如：
    // - AWS CloudWatch
    // - Google Cloud Logging
    // - LogDNA
    // - Papertrail
    // 等等

    try {
      // 示例：发送到外部服务
      // await fetch('https://logging-service.com/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(logEntry),
      // });
    } catch (error) {
      // 避免日志记录失败影响主要功能
      console.error("发送外部日志失败:", error.message);
    }
  }

  /**
   * 创建子日志记录器
   * @param {string} component - 组件名称
   * @returns {Object} 子日志记录器
   */
  static child(component) {
    return {
      error: (message, error, metadata) =>
        this.error(`[${component}] ${message}`, error, metadata),
      warn: (message, metadata) =>
        this.warn(`[${component}] ${message}`, metadata),
      info: (message, metadata) =>
        this.info(`[${component}] ${message}`, metadata),
      debug: (message, metadata) =>
        this.debug(`[${component}] ${message}`, metadata),
    };
  }
}
