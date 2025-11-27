/**
 * GitHub API 服务
 * 处理与 GitHub API 的交互
 */

import {
  GITHUB_CONFIG,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "../config/constants.js";

/**
 * GitHub 服务类
 */
export class GitHubService {
  /**
   * 获取 GitHub 文件内容
   * @param {string} path - 文件路径 (owner/repo/branch/path)
   * @param {string} token - GitHub 访问令牌
   * @returns {Object} 包含内容和类型的响应对象
   */
  static async fetchFile(path, token) {
    try {
      // 构建 GitHub URL
      const url = `${GITHUB_CONFIG.BASE_URL}/${path}`;

      // 准备请求头
      const headers = {
        "User-Agent": "GitHub-Raw-Proxy/1.0",
      };

      // 如果有令牌，添加授权头
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 发送请求
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(GITHUB_CONFIG.TIMEOUT),
      });

      // 检查响应状态
      if (!response.ok) {
        throw new Error(
          `GitHub API 错误: ${response.status} ${response.statusText}`
        );
      }

      // 获取内容类型
      const contentType = response.headers.get("content-type") || "text/plain";

      // 根据内容类型获取响应内容
      let content;
      if (contentType.includes("application/json")) {
        content = await response.text();
      } else if (contentType.includes("text/")) {
        content = await response.text();
      } else {
        // 对于二进制文件，转换为 base64
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
      // 处理不同类型的错误
      let errorMessage = ERROR_MESSAGES.GITHUB_ERROR;

      if (error.name === "AbortError") {
        errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR;
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
      }

      return {
        success: false,
        error: errorMessage,
        details: error.message,
      };
    }
  }

  /**
   * 检查 GitHub 仓库是否存在
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名称
   * @param {string} token - GitHub 访问令牌
   * @returns {boolean} 仓库是否存在
   */
  static async checkRepositoryExists(owner, repo, token) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
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

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 解析 GitHub 路径
   * @param {string} path - GitHub 路径
   * @returns {Object} 解析后的路径组件
   */
  static parseGitHubPath(path) {
    const parts = path.split("/");

    if (parts.length < 4) {
      throw new Error("无效的 GitHub 路径格式");
    }

    return {
      owner: parts[0],
      repo: parts[1],
      branch: parts[2],
      filePath: parts.slice(3).join("/"),
    };
  }

  /**
   * 验证 GitHub 路径组件
   * @param {Object} pathComponents - 路径组件对象
   * @returns {boolean} 验证结果
   */
  static validatePathComponents(pathComponents) {
    const { owner, repo, branch, filePath } = pathComponents;

    // 检查所有组件是否存在
    if (!owner || !repo || !branch || !filePath) {
      return false;
    }

    // 检查组件格式
    const namePattern = /^[a-zA-Z0-9._-]+$/;

    return (
      namePattern.test(owner) &&
      namePattern.test(repo) &&
      namePattern.test(branch)
    );
  }
}
