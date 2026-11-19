/**
 * 响应构造：错误跳转与成功响应。
 *
 * 错误响应永远 302 到固定地址，不携带原始路径、查询参数或令牌；
 * 成功响应透传上游状态码与白名单头部，响应体保持原始流。
 */

// 相对导入写编译后扩展名 .js（Vercel 1:1 转译后由纯 Node ESM 加载）。
import {
	CACHE_CONTROL,
	DEFAULT_CONTENT_TYPE,
	ERROR_REDIRECT_URL,
} from "./config.js";

const FORWARDED_RESPONSE_HEADERS = [
	"etag",
	"last-modified",
	"accept-ranges",
	"content-range",
] as const;

/** 所有错误场景共用的固定 302 跳转。 */
export function errorRedirect(): Response {
	return new Response(null, {
		status: 302,
		headers: {
			Location: ERROR_REDIRECT_URL,
			"Cache-Control": "no-store",
		},
	});
}

/**
 * 把上游非错误响应转成客户端响应。
 *
 * 响应体直接使用上游 ReadableStream，全程流式、零缓冲。
 * 上游 3xx 里的 304 等非错误状态也照常透传。
 */
export function successResponse(upstream: Response): Response {
	const headers = new Headers({
		"Cache-Control": CACHE_CONTROL,
		"Content-Type":
			upstream.headers.get("content-type") || DEFAULT_CONTENT_TYPE,
	});

	for (const name of FORWARDED_RESPONSE_HEADERS) {
		const value = upstream.headers.get(name);
		if (value) {
			headers.set(name, value);
		}
	}

	return new Response(upstream.body, {
		status: upstream.status,
		headers,
	});
}
