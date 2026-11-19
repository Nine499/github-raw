/**
 * 脱敏日志。
 *
 * 只记录可安全公开的摘要字段；token、Authorization、Cookie、IP、
 * 完整查询字符串、请求体与响应体一律不落日志。
 * 路径在模块内部脱敏，调用方传入原始值即可。
 */

/** 控制字符替换为问号并截断，避免日志注入与超长行。 */
function safePath(path: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: 蓄意匹配控制字符以脱敏日志
	return path.replace(/[\x00-\x1f\x7f]/g, "?").slice(0, 200) || "(empty)";
}

export interface AccessLogFields {
	requestId: string;
	method: string;
	/** 原始仓库路径，落日志前在本模块内脱敏。 */
	path: string;
	pathLength: number;
	authentication: string;
	outcome: string;
	responseStatus: number;
	durationMs: number;
	upstreamStatus?: number | undefined;
}

export function logAccess(fields: AccessLogFields): void {
	const message = Object.entries({
		...fields,
		path: safePath(fields.path),
	})
		.filter(([, value]) => value !== undefined)
		.map(([name, value]) => `${name}=${value}`)
		.join(" ");
	console.log(`[github-raw] ${message}`);
}
