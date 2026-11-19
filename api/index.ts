/**
 * 唯一业务入口：鉴权 → 上游请求 → 响应。
 *
 * 所有路径经 vercel.json rewrite 汇到这里，path 以查询参数注入。
 * Vercel 现行推荐的 Node.js runtime + Web 标准 fetch 签名。
 */

import { randomUUID } from "node:crypto";

import { classifyAuth } from "../src/auth.ts";
import { logAccess } from "../src/log.ts";
import { errorRedirect, successResponse } from "../src/proxy-response.ts";
import { fetchUpstream } from "../src/upstream.ts";

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
