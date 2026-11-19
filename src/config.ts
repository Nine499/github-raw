/**
 * 环境变量与固定常量。
 *
 * 读取时机在每次请求内完成，Vercel 环境变量变更后重新部署即生效。
 */

/** 环境变量名属于对外兼容性契约，不可重命名。 */
export const ACCESS_TOKEN_ENV = "NINE49TOKEN";
export const GITHUB_TOKEN_ENV = "GITHUB49TOKEN";

/** 鉴权失败、路径为空、上游异常时的固定跳转地址。 */
export const ERROR_REDIRECT_URL = "https://www.baidu.com/";

/** 成功响应的固定缓存策略：浏览器 5 分钟，Vercel Edge 1 小时。 */
export const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

/** 请求 GitHub Raw 的固定基地址与 User-Agent。 */
export const RAW_BASE_URL = "https://raw.githubusercontent.com/";
export const UPSTREAM_USER_AGENT = "Vercel-Github-Proxy";

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** 请求 GitHub Raw 时可配置的可选 token。 */
export function readGithubToken(): string | undefined {
	return process.env[GITHUB_TOKEN_ENV] || undefined;
}

/** 代理入口令牌；未配置时所有请求都视为未通过鉴权。 */
export function readAccessToken(): string | undefined {
	return process.env[ACCESS_TOKEN_ENV] || undefined;
}
