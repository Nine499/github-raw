/**
 * GitHub Raw 代理服务主入口
 * 优化版本 - 模块化、易维护、高性能
 */

import { RequestValidator } from "./utils/validation.js";
import { GitHubService } from "./services/github.js";
import { CacheService } from "./services/cache.js";
import { ErrorHandler } from "./utils/errors.js";
import { Logger } from "./utils/logger.js";
import { SECURITY_CONFIG, CACHE_CONFIG } from "./config/constants.js";

// 获取环境变量
const { NINE49TOKEN, GITHUB49TOKEN } = process.env;

/**
 * 主处理函数
 * @param {Object} request - HTTP 请求对象
 * @param {Object} response - HTTP 响应对象
 * @returns {void}
 */
export default async function handler(request, response) {
  const startTime = Date.now();

  try {
    // 记录请求日志
    Logger.request(request, {
      query: request.query,
      headers: request.headers,
    });

    // 验证请求参数
    const validation = RequestValidator.validateRequest(request.query);
    if (!validation.isValid) {
      Logger.warn("请求验证失败", { errors: validation.errors });
      return ErrorHandler.handleValidationError(response, validation.errors);
    }

    // 提取参数
    const { "nine-token": userToken, path: githubPath } = request.query;

    // 验证用户令牌
    if (!RequestValidator.validateToken(userToken, NINE49TOKEN)) {
      Logger.warn("令牌验证失败", {
        providedToken: userToken ? "[REDACTED]" : "missing",
      });
      return response.redirect(SECURITY_CONFIG.REDIRECT_URL);
    }

    // 清理和验证路径
    const sanitizedPath = RequestValidator.sanitizePath(githubPath);
    if (!RequestValidator.validatePath(sanitizedPath)) {
      Logger.warn("路径验证失败", { originalPath: githubPath });
      return ErrorHandler.handleValidationError(response, ["无效的文件路径"]);
    }

    // 检查缓存
    const cachedResult = CacheService.get(sanitizedPath, GITHUB49TOKEN);
    if (cachedResult) {
      Logger.info("缓存命中", {
        path: sanitizedPath,
        cacheStats: CacheService.getStats(),
      });
      
      // 设置缓存相关的响应头
      response.setHeader("X-Cache", "HIT");
      response.setHeader("Cache-Control", `public, max-age=${CACHE_CONFIG.TTL}`);
      
      if (cachedResult.contentType) {
        response.setHeader("Content-Type", cachedResult.contentType);
      }
      
      response.status(200).send(cachedResult.content);
      
      const duration = Date.now() - startTime;
      Logger.info("缓存响应成功", {
        path: sanitizedPath,
        contentType: cachedResult.contentType,
        duration: `${duration}ms`,
      });
      
      return;
    }

    // 缓存未命中，获取 GitHub 文件内容
    const githubResult = await GitHubService.fetchFile(
      sanitizedPath,
      GITHUB49TOKEN
    );

    if (!githubResult.success) {
      Logger.error("GitHub API 调用失败", githubResult.error, {
        path: sanitizedPath,
        details: githubResult.details,
      });
      return ErrorHandler.handleGitHubError(response, githubResult);
    }

    // 验证文件类型
    if (!RequestValidator.validateFileType(githubResult.contentType)) {
      Logger.warn("不支持的文件类型", {
        path: sanitizedPath,
        contentType: githubResult.contentType,
      });
      return ErrorHandler.handleValidationError(response, ["不支持的文件类型"]);
    }

    // 缓存成功的结果
    CacheService.set(sanitizedPath, GITHUB49TOKEN, githubResult);
    
    // 设置缓存相关的响应头
    response.setHeader("X-Cache", "MISS");
    response.setHeader("Cache-Control", `public, max-age=${CACHE_CONFIG.TTL}`);

    // 设置响应头
    if (githubResult.contentType) {
      response.setHeader("Content-Type", githubResult.contentType);
    }

    // 添加跨域头
    response.setHeader("Access-Control-Allow-Origin", "*"); // 允许跨域
    response.setHeader("Access-Control-Allow-Methods", "GET");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // 返回文件内容
    response.status(200).send(githubResult.content);

    // 记录成功日志
    const duration = Date.now() - startTime;
    Logger.info("请求处理成功", {
      path: sanitizedPath,
      contentType: githubResult.contentType,
      duration: `${duration}ms`,
    });
  } catch (error) {
    // 统一错误处理
    const duration = Date.now() - startTime;
    Logger.error("请求处理异常", error, {
      duration: `${duration}ms`,
      query: request.query,
    });

    ErrorHandler.handleError(response, error);
  }
}
