/**
 * 唯一业务入口：鉴权 → 上游请求 → 响应。
 *
 * 所有路径经 vercel.json rewrite 汇到这里，path 以查询参数注入。
 * Vercel 现行推荐的 Node.js runtime + Web 标准 fetch 签名。
 */

import { randomUUID } from "node:crypto";

// 相对导入写编译后扩展名 .js：Vercel 对 api/ 近乎 1:1 转译、不打包，
// 运行时是纯 Node ESM loader，无法解析 .ts 扩展名。
import { classifyAuth } from "../src/auth.js";
import { logAccess } from "../src/log.js";
import { errorRedirect, successResponse } from "../src/proxy-response.js";
import { fetchUpstream } from "../src/upstream.js";

export default async function handler(request: Request): Promise<Response> {
	const requestId = randomUUID();
	const startedAt = Date.now();

	const url = new URL(request.url);
	const githubPath = (url.searchParams.get("path") || "").replace(/^\/+/, "");
	const authentication = classifyAuth(url.searchParams.get("nine-token"));

	const log = (
		outcome: string,
		responseStatus: number,
		upstreamStatus?: number,
	) =>
		logAccess({
			requestId,
			method: request.method || "UNKNOWN",
			path: githubPath,
			pathLength: githubPath.length,
			authentication,
			outcome,
			responseStatus,
			durationMs: Date.now() - startedAt,
			upstreamStatus,
		});

	if (authentication !== "valid") {
		log("authentication-rejected", 302);
		return errorRedirect();
	}

	if (!githubPath) {
		log("path-rejected", 302);
		return errorRedirect();
	}

	let upstream: Response;
	try {
		upstream = await fetchUpstream(githubPath, request.headers);
	} catch {
		log("upstream-network-error", 302);
		return errorRedirect();
	}

	if (upstream.status >= 400) {
		log("upstream-error", 302, upstream.status);
		return errorRedirect();
	}

	log("success", upstream.status, upstream.status);
	return successResponse(upstream);
}
