# AGENTS.md

Guidance for coding agents and LLMs working in this repository. Human-facing docs live in `README.md`.

## What this is

A minimal GitHub Raw proxy deployed on Vercel. One serverless function authenticates each request with a shared token, fetches `https://raw.githubusercontent.com/<path>`, and streams the upstream body back. It is not a general-purpose HTTP proxy — fixed path forwarding and two small header whitelists only.

Tech shape: a **single-file zero-dependency JS function** (`api/github-raw.js`) using the classic `VercelRequest`/`VercelResponse` signature with Node `fetch` and `Readable.fromWeb` + `pipeline` streaming. No framework, no build step, no runtime deps, no `package.json`.

> **History note**: this repo was briefly rewritten to TypeScript + web-standard fetch with a `src/` module layer. That version crashed in production (`FUNCTION_INVOCATION_FAILED`) and was reverted. Keep the single-file, zero-import shape unless you have verified a new deployment shape end-to-end — see Traps.

## Stack & Run

- Node.js (Vercel runtime; local checks run fine on Node 24). No package manager, no lockfile, no dependencies.
- There is no `package.json`, so none of `npm run build` / `npm test` / `npm run lint` exist. Do not invent them.

Local static checks (syntax + ESM load only; no request simulation, no upstream calls):

```bash
node --check api/github-raw.js
node --input-type=module -e "await import('./api/github-raw.js')"
```

Local smoke test with a fake `req`/`res` pair (hits the real GitHub Raw; see README's smoke section for a runnable template):

- No/wrong/missing-config token, empty `path` → expect 302 + `Location: https://www.baidu.com/` + `Cache-Control: no-store`.
- Valid token + real path → expect 200, upstream `Content-Type`, fixed cache header, streamed body.
- Upstream 404 → 302. `Range` request → 206 + `Content-Range`.

Deployed contract check (substitute `<domain>` and `<NINE49TOKEN>`; use `curl -i`, never `-L`, when inspecting redirects):

```bash
curl -i 'https://<domain>/?nine-token=<NINE49TOKEN>'
curl -i 'https://<domain>/octocat/Hello-World/master/README'
curl -i 'https://<domain>/octocat/Hello-World/master/README?nine-token=<NINE49TOKEN>'
```

## Layout

```text
api/
  github-raw.js   # the entire proxy: constants, helpers, and the single handler
vercel.json       # a root redirect + the only rewrite: / → Baidu; /:path* → /api/github-raw.js?path=:path*
CLAUDE.md         # pointer to this file
AGENTS.md         # this file — single source of truth for engineering guidance
README.md         # human-facing deployment & interface docs
License           # license text
.gitignore        # standard ignores
```

Why the root redirect exists: Vercel checks for a static index before the `/:path*` rewrite on the bare root, and this project has no static output — so `/` 404s at the routing layer and never reaches the function. The `redirects` rule (evaluated before rewrites) sends the bare root to the same fixed Baidu address, making the outward behavior uniform: every invalid request, root included, lands on the same 302.

## Request pipeline

`handler(req, res)` in `api/github-raw.js`, in order:

1. Generate `requestId` (`randomUUID`) and start the clock; read `NINE49TOKEN` and optional `GITHUB49TOKEN` from `process.env`.
2. Parse `req.url` with `new URL(req.url, "http://github-raw.local")` — the base is a fixed dummy; only the query string matters. Read `path` (strip leading slashes) and `nine-token`.
3. `classifyAuthentication()` returns one of `missing` / `not-configured` / `invalid` / `valid`. Comparison uses `timingSafeEqual` (constant-time) — never revert to `===`, which leaks token bits via response timing.
4. Anything but `valid`, or empty `path` → log + `redirectError()`: 302 to `https://www.baidu.com/` with `Cache-Control: no-store`.
5. `buildUpstreamHeaders()`: fixed `User-Agent`; optional `Authorization: token <GITHUB49TOKEN>`; whitelist-forward `if-none-match`, `if-modified-since`, `range`, `if-range` from the client. Nothing else is forwarded (no cookies, no client `Authorization`).
6. `fetch(RAW_BASE_URL + path)`. Network error, or upstream status ≥ 400 → same fixed 302. Upstream error bodies never reach the client.
7. `writeSuccessHeaders()`: pass through upstream status (< 400), fixed `Cache-Control: public, max-age=300, s-maxage=3600`, upstream `Content-Type` (fallback `application/octet-stream`), whitelist `etag` / `last-modified` / `accept-ranges` / `content-range`.
8. Stream the body with `Readable.fromWeb(upstream.body)` + `pipeline(..., res)`. If the stream fails after headers are sent, log it — a second response cannot be sent at that point.

## Conventions

- **Single file, zero imports**: all logic lives in `api/github-raw.js`. Shared constants sit at the top under a contract banner; helpers are plain functions above the handler. Do not split into modules.
- **Error funnel**: every failure path (auth, empty path, network, upstream ≥ 400) funnels into the same fixed 302. No JSON errors, no upstream error bodies.
- **Logging**: one redacted line per request via `logAccess()`. Fields: requestId, method, `safePath()`-truncated path + length, auth class, outcome, statuses, duration. Never log token values, `Authorization`, cookies, IPs, full query strings, or bodies. Any new field must be checked against this list.
- **Naming contract**: `NINE49TOKEN` / `GITHUB49TOKEN` env vars, `nine-token` / `path` query params, the URL shape, the Baidu redirect, and the cache headers are a compatibility contract. Do not rename or re-semantics them.
- **Docs sync**: `README.md`, `vercel.json`, and `api/github-raw.js` must always describe the same outward contract. A change to any one requires checking the other two.

## Tasks

**Change proxy behavior** (auth, redirects, caching, statuses):
1. Edit the relevant helper or constant in `api/github-raw.js` (minimal diff).
2. Update the matching README section.
3. Run both static checks; smoke the changed branch with a fake req/res.
4. If deployed, run the three curl contract checks.

**Change routing**: edit the redirect/rewrite rules in `vercel.json`, verify `path` still reaches the function as a query param, sync README's URL examples. Keep the bare-root redirect first — removing it brings back the routing-layer 404 on `/`.

**Add a forwarded header**: extend the relevant whitelist (`FORWARDED_REQUEST_HEADERS` / `FORWARDED_RESPONSE_HEADERS`), document in README, and state why it is safe (caching, privacy, implementation-detail exposure).

**Adjust logging**: edit `logAccess()` / `safePath()`; keep redaction inside so callers pass raw values.

## Traps

- **Do not modularize into cross-file imports without end-to-end deployment verification.** The reverted TypeScript rewrite crashed in production because Vercel transpiles `api/` near 1:1 *without bundling* — the plain Node ESM loader resolved `import "./x.ts"` at runtime and died (`FUNCTION_INVOCATION_FAILED`), while `tsc` and local type stripping both stayed green. Any multi-file or TS rewrite must be verified against a real deployment before the old shape is deleted.
- **Streaming is the performance-critical path.** `Readable.fromWeb` + `pipeline` streams chunk-by-chunk. Do not revert to `arrayBuffer()`, `Buffer`, or whole-body reads.
- **Never `git add -A` blindly in this repo.** Files have been mysteriously deleted from the working tree mid-session before; a blind `git add -A` stages those deletions. Check `git status --short` and understand every entry before staging.
- The rewrite destination `/api/github-raw.js` includes the extension — this matches the actual file name. Keep it in sync with the file's real name if you ever rename the handler file.
- No test framework exists. Do not introduce one for a small change; report which behaviors were verified locally vs. static-check only.
- Never echo real token values into logs, commits, or docs — placeholders only.
