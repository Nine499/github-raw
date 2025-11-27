/**
 * 错误处理工具
 * 统一处理各种类型的错误
 */

import {
  HTTP_STATUS,
  SECURITY_CONFIG,
  ERROR_MESSAGES,
  GITHUB_CONFIG,
} from "../config/constants.js";

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 处理验证错误
   * @param {Object} response - Express 响应对象
   * @param {Array} errors - 错误列表
   * @returns {void}
   */
  static handleValidationError(response, errors = []) {
    const errorMessage = errors.join("; ");
    this.logError("验证错误", errorMessage, { errors });

    return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
  }

  /**
   * 处理 GitHub API 错误
   * @param {Object} response - Express 响应对象
   * @param {Object} error - 错误对象
   * @returns {void}
   */
  static handleGitHubError(response, error) {
    this.logError("GitHub API 错误", error.error || error.message, {
      details: error.details,
    });

    return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
  }

  /**
   * 处理系统错误
   * @param {Object} response - Express 响应对象
   * @param {Error} error - 错误对象
   * @returns {void}
   */
  static handleSystemError(response, error) {
    this.logError("系统错误", error.message, {
      stack: error.stack,
    });

    return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
  }

  /**
   * 处理网络错误
   * @param {Object} response - Express 响应对象
   * @param {Object} error - 错误对象
   * @returns {void}
   */
  static handleNetworkError(response, error) {
    this.logError("网络错误", error.message, {
      timeout: error.name === "AbortError",
    });

    return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
  }

  /**
   * 处理超时错误
   * @param {Object} response - Express 响应对象
   * @param {Object} error - 错误对象
   * @returns {void}
   */
  static handleTimeoutError(response, error) {
    this.logError("超时错误", ERROR_MESSAGES.TIMEOUT_ERROR, {
      timeout: GITHUB_CONFIG.TIMEOUT,
    });

    return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
  }

  /**
   * 创建标准化错误响应
   * @param {string} message - 错误消息
   * @param {number} status - HTTP 状态码
   * @param {Object} details - 错误详情
   * @returns {Object} 标准化错误对象
   */
  static createErrorResponse(
    message,
    status = HTTP_STATUS.INTERNAL_ERROR,
    details = {}
  ) {
    return {
      success: false,
      error: message,
      status,
      timestamp: new Date().toISOString(),
      details,
    };
  }

  /**
   * 判断错误类型并处理
   * @param {Object} response - Express 响应对象
   * @param {Error|Object} error - 错误对象
   * @returns {void}
   */
  static handleError(response, error) {
    // 根据错误类型选择处理方法
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return this.handleTimeoutError(response, error);
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return this.handleNetworkError(response, error);
    }

    if (error.error && error.error.includes("GitHub")) {
      return this.handleGitHubError(response, error);
    }

    if (error.errors && Array.isArray(error.errors)) {
      return this.handleValidationError(response, error.errors);
    }

    // 默认处理为系统错误
    return this.handleSystemError(response, error);
  }

  /**
   * 记录错误日志
   * @param {string} type - 错误类型
   * @param {string} message - 错误消息
   * @param {Object} metadata - 附加元数据
   * @returns {void}
   */
  static logError(type, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      ...metadata,
    };

    // 在生产环境中，这里可以集成外部日志服务
    console.error(`[${type}] ${message}`, JSON.stringify(logEntry, null, 2));
  }

  /**
   * 检查是否为客户端错误
   * @param {number} status - HTTP 状态码
   * @returns {boolean} 是否为客户端错误
   */
  static isClientError(status) {
    return status >= 400 && status < 500;
  }

  /**
   * 检查是否为服务器错误
   * @param {number} status - HTTP 状态码
   * @returns {boolean} 是否为服务器错误
   */
  static isServerError(status) {
    return status >= 500;
  }

  /**
   * 获取用户友好的错误消息
   * @param {string} errorKey - 错误键
   * @returns {string} 用户友好的错误消息
   */
  static getUserFriendlyMessage(errorKey) {
    const messages = {
      [ERROR_MESSAGES.INVALID_TOKEN]: "访问令牌无效，请检查您的访问权限",
      [ERROR_MESSAGES.INVALID_PATH]: "文件路径格式不正确，请检查路径格式",
      [ERROR_MESSAGES.GITHUB_ERROR]: "GitHub 服务暂时不可用，请稍后重试",
      [ERROR_MESSAGES.NETWORK_ERROR]: "网络连接出现问题，请检查您的网络",
      [ERROR_MESSAGES.TIMEOUT_ERROR]: "请求超时，请稍后重试",
      [ERROR_MESSAGES.RATE_LIMIT_EXCEEDED]: "请求过于频繁，请稍后再试",
    };

    return messages[errorKey] || "服务暂时不可用，请稍后重试";
  }
}
