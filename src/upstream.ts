/**
 * 上游请求：向 GitHub Raw 转发文件请求。
 *
 * 只转发协商缓存与范围请求相关的请求头，避免把客户端的其他头部
 * （如 Cookie、Authorization）透传给上游。
 */

// 相对导入写编译后扩展名 .js（Vercel 1:1 转译后由纯 Node ESM 加载）。
import {
	RAW_BASE_URL,
	readGithubToken,
	UPSTREAM_USER_AGENT,
} from "./config.js";

const FORWARDED_REQUEST_HEADERS = [
	"if-none-match",
	"if-modified-since",
	"range",
	"if-range",
] as const;

/** 上游请求头白名单之外的客户端请求头一律不转发。 */
export function buildUpstreamHeaders(clientHeaders: Headers): Headers {
	const headers = new Headers({
		"User-Agent": UPSTREAM_USER_AGENT,
	});

	const githubToken = readGithubToken();
	if (githubToken) {
		headers.set("Authorization", `token ${githubToken}`);
	}

	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = clientHeaders.get(name);
		if (value) {
			headers.set(name, value);
		}
	}

	return headers;
}

/**
 * 请求 GitHub Raw 上游。
 *
 * githubPath 是去掉开头斜杠的仓库路径，直接拼接到 Raw 基地址之后。
 * 网络层抛错（DNS、TLS、超时等）时向上抛出，由调用方统一处理。
 */
export async function fetchUpstream(
	githubPath: string,
	clientHeaders: Headers,
): Promise<Response> {
	return fetch(`${RAW_BASE_URL}${githubPath}`, {
		headers: buildUpstreamHeaders(clientHeaders),
	});
}
