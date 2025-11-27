/**
 * 请求验证工具
 * 提供各种输入验证和清理功能
 */

import { SECURITY_CONFIG, ERROR_MESSAGES } from "../config/constants.js";

/**
 * 请求验证器类
 */
export class RequestValidator {
  /**
   * 验证用户令牌
   * @param {string} userToken - 用户提供的令牌
   * @param {string} expectedToken - 期望的令牌
   * @returns {boolean} 验证结果
   */
  static validateToken(userToken, expectedToken) {
    if (!userToken || !expectedToken) {
      return false;
    }
    return userToken === expectedToken;
  }

  /**
   * 验证 GitHub 路径
   * @param {string} path - GitHub 文件路径
   * @returns {boolean} 验证结果
   */
  static validatePath(path) {
    if (!path || typeof path !== "string") {
      return false;
    }

    // 检查路径长度
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

  /**
   * 清理和标准化路径
   * @param {string} path - 原始路径
   * @returns {string} 清理后的路径
   */
  static sanitizePath(path) {
    if (!path) return "";

    return path
      .trim()
      .replace(/\/+/g, "/") // 将多个斜杠替换为单个斜杠
      .replace(/^\//, "") // 移除开头的斜杠
      .replace(/\/$/, ""); // 移除结尾的斜杠
  }

  /**
   * 验证文件类型是否允许
   * @param {string} contentType - 文件内容类型
   * @returns {boolean} 验证结果
   */
  static validateFileType(contentType) {
    if (!contentType) return true; // 如果没有内容类型，默认允许

    return SECURITY_CONFIG.ALLOWED_FILE_TYPES.some((type) =>
      contentType.toLowerCase().includes(type)
    );
  }

  /**
   * 验证请求参数
   * @param {Object} query - 请求查询参数
   * @returns {Object} 验证结果
   */
  static validateRequest(query) {
    const errors = [];

    // 检查必需参数
    if (!query["nine-token"]) {
      errors.push(ERROR_MESSAGES.INVALID_TOKEN);
    }

    if (!query.path) {
      errors.push(ERROR_MESSAGES.INVALID_PATH);
    }

    // 验证路径格式
    if (query.path && !this.validatePath(query.path)) {
      errors.push(ERROR_MESSAGES.INVALID_PATH);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
