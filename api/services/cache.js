/**
 * 缓存服务
 * 提供内存缓存功能，提升 API 响应速度
 */

import { CACHE_CONFIG } from "../config/constants.js";

/**
 * 简单的内存缓存实现
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 生存时间（秒）
   */
  set(key, value, ttl = CACHE_CONFIG.TTL) {
    // 如果已存在，先清除旧定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // 设置缓存
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000, // 转换为毫秒
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

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any|null} 缓存值或 null
   */
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

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.cache.delete(key);

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * 清空所有缓存
   */
  clear() {
    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.cache.clear();
    this.timers.clear();
  }

  /**
   * 淘汰最旧的缓存项
   */
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

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: CACHE_CONFIG.MAX_SIZE,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// 创建全局缓存实例
const cache = new MemoryCache();

/**
 * 缓存服务类
 */
export class CacheService {
  /**
   * 生成缓存键
   * @param {string} path - GitHub 路径
   * @param {string} token - 访问令牌哈希
   * @returns {string} 缓存键
   */
  static generateKey(path, token = "") {
    const tokenHash = token ? this.simpleHash(token) : "";
    return `${CACHE_CONFIG.KEY_PREFIX}${path}:${tokenHash}`;
  }

  /**
   * 简单哈希函数
   * @param {string} str - 要哈希的字符串
   * @returns {string} 哈希值
   */
  static simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取缓存内容
   * @param {string} path - GitHub 路径
   * @param {string} token - 访问令牌
   * @returns {Object|null} 缓存的响应或 null
   */
  static get(path, token = "") {
    const key = this.generateKey(path, token);
    return cache.get(key);
  }

  /**
   * 设置缓存内容
   * @param {string} path - GitHub 路径
   * @param {string} token - 访问令牌
   * @param {Object} response - 响应对象
   * @param {number} ttl - 生存时间（秒）
   */
  static set(path, token, response, ttl = CACHE_CONFIG.TTL) {
    const key = this.generateKey(path, token);
    cache.set(key, response, ttl);
  }

  /**
   * 删除特定缓存
   * @param {string} path - GitHub 路径
   * @param {string} token - 访问令牌
   */
  static delete(path, token = "") {
    const key = this.generateKey(path, token);
    cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  static clear() {
    cache.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  static getStats() {
    return cache.getStats();
  }

  /**
   * 检查缓存是否命中
   * @param {string} path - GitHub 路径
   * @param {string} token - 访问令牌
   * @returns {boolean} 是否命中缓存
   */
  static has(path, token = "") {
    const key = this.generateKey(path, token);
    return cache.get(key) !== null;
  }

  /**
   * 预热缓存
   * @param {Array} paths - 路径数组
   * @param {string} token - 访问令牌
   * @param {Function} fetchFunction - 获取数据的函数
   */
  static async warmup(paths, token, fetchFunction) {
    const promises = paths.map(async (path) => {
      if (!this.has(path, token)) {
        try {
          const response = await fetchFunction(path, token);
          if (response.success) {
            this.set(path, token, response);
          }
        } catch (error) {
          console.warn(`缓存预热失败: ${path}`, error.message);
        }
      }
    });

    await Promise.allSettled(promises);
  }
}
