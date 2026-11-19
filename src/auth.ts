/**
 * 鉴权：校验请求中的 nine-token 与服务端令牌。
 */

// 相对导入写编译后扩展名 .js（Vercel 1:1 转译后由纯 Node ESM 加载）。
import { readAccessToken } from "./config.js";

export type AuthStatus = "missing" | "not-configured" | "invalid" | "valid";

/**
 * 将鉴权状态归为四类之一。
 *
 * 服务端令牌未配置时一律拒绝，不会开放匿名访问；
 * 只有请求令牌与服务端令牌完全一致才是 valid。
 */
export function classifyAuth(requestToken: string | null): AuthStatus {
	const accessToken = readAccessToken();
	if (!accessToken) {
		return "not-configured";
	}
	if (requestToken === accessToken) {
		return "valid";
	}
	return requestToken ? "invalid" : "missing";
}
