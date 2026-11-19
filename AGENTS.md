# AGENTS.md

Guidance for coding agents and LLMs working in this repository. Human-facing docs live in `README.md`.

## What this is

A minimal GitHub Raw proxy deployed on Vercel. One function authenticates each request with a shared token, fetches `https://raw.githubusercontent.com/<path>`, and streams the upstream body back. It is not a general-purpose HTTP proxy — fixed path forwarding and a small header whitelist only.

Tech shape: Vercel's currently recommended **Node.js runtime + web-standard `fetch(request)` signature**. The function depends only on web-standard APIs (`Request`, `Response`, `Headers`, `fetch`) plus `randomUUID` from `node:crypto`. Zero runtime dependencies, no build step.

## Stack & Run

- Node.js pinned by `.node-version` (use `fnm use`); package manager is pnpm only. Node must already be installed — never run `fnm install` or auto-download Node; if the version is missing, stop and report.
- TypeScript with strict mode; `tsc --noEmit` only — Vercel compiles on deploy, nothing is emitted locally.
- Biome for lint and format. No ESLint, no Prettier.

```bash
pnpm install          # devDependencies only: typescript, @types/node, @biomejs/biome
pnpm run typecheck   # tsc --noEmit
pnpm run biome:check # lint + format check
pnpm run biome:fix   # auto-fix
```

Local smoke test — Node 24 runs the TS directly via type stripping; hits the real GitHub Raw:

```bash
NINE49TOKEN=testtoken node --input-type=module -e "
const mod = await import('./api/index.ts');
const h = mod.default;
const res = await h(new Request('https://x.vercel.app/api/index?path=octocat/Hello-World/master/README&nine-token=testtoken'));
console.log(res.status, res.headers.get('content-type'));
"
```

Cover error branches by dropping the `nine-token` param or emptying `path`.

Deployed contract check (substitute `<domain>` and `<NINE49TOKEN>`; use `curl -i`, never `-L`, when inspecting redirects):

```bash
curl -i 'https://<domain>/?nine-token=<NINE49TOKEN>'
curl -i 'https://<domain>/octocat/Hello-World/master/README'
curl -i 'https://<domain>/octocat/Hello-World/master/README?nine-token=<NINE49TOKEN>'
```

## Layout

```text
api/
  index.ts            # sole entry point: assembles auth → upstream → response
src/
  config.ts           # env var names + fixed constants (compat contract lives here)
  auth.ts             # classifyAuth(): missing / not-configured / invalid / valid
  upstream.ts         # upstream request-header whitelist + fetchUpstream()
  proxy-response.ts   # errorRedirect() (302 + no-store) and successResponse() (streaming)
  log.ts              # logAccess() + safePath(); path redaction happens inside this module
vercel.json           # the only rewrite: /:path* → /api/index?path=:path*
tsconfig.json         # strict, noEmit, allowImportingTsExtensions
package.json          # devDependencies only, no runtime deps
.node-version         # Node pin (v24.22.3)
```

## Conventions

- pnpm only; never npm / yarn / npx / bun. Node version comes from `.node-version` via `fnm use`.
- `api/index.ts` stays a thin assembly layer; business behavior belongs in a `src/` module. Five `src/` modules is the ceiling — do not split further without need.
- Error handling: every failure path (auth, empty path, upstream network error, upstream ≥ 400) funnels into the same fixed `302` to `https://www.baidu.com/`. No JSON error bodies, no upstream error bodies passed through.
- Header policy: both request and response headers go through whitelists (`If-None-Match`, `If-Modified-Since`, `Range`, `If-Range` in; `ETag`, `Last-Modified`, `Accept-Ranges`, `Content-Range` out). Evaluate caching, privacy, and implementation-detail exposure before adding any header.
- Logging: one redacted summary line per request. Never log token values, `Authorization`, cookies, IPs, full query strings, or bodies. New log fields must be checked item by item against this rule.
- Naming: `NINE49TOKEN` / `GITHUB49TOKEN` env vars and the `nine-token` / `path` query params are a compatibility contract — never rename or re-semantics them.

## Tasks

**Change proxy behavior** (auth, redirects, caching, status codes):

1. Locate the owning `src/` module (`auth.ts`, `proxy-response.ts`, `upstream.ts`, `config.ts`).
2. Make the minimal diff; keep names and comment density.
3. Update `README.md`'s corresponding section — README, `vercel.json`, and `api/index.ts` must always describe the same contract.
4. Run `pnpm run typecheck` and `pnpm run biome:check`; smoke-test the changed branch locally.
5. If deployed, run the three curl contract checks.

**Change routing**: edit the rewrite in `vercel.json`, then verify `path` still arrives in the function, and sync README's URL examples.

**Add a forwarded header**: add to the relevant whitelist in `upstream.ts` (request) or `proxy-response.ts` (response), document in README, and state why it is safe.

**Adjust logging**: edit `src/log.ts`; `safePath()` redaction stays inside the module so callers pass raw values.

## Traps

- `successResponse` passes the upstream `ReadableStream` straight through as the response body. Do not revert to `arrayBuffer()`, `Buffer`, or Node stream adapters (`Readable.fromWeb` + `pipeline`) — streaming is the performance-critical path.
- The rewrite destination `/api/index` carries no file extension; this matches Vercel's documented rewrite form. If a deployed 404 appears where the function should be, suspect the rewrite destination first. This can only be verified post-deploy.
- No test framework exists. Do not introduce one for a small change; report which behaviors were verified locally vs. which are static-check only.
- Never echo real token values into logs, commits, or docs — placeholders only.
- Once a response has started streaming, you cannot send a second response (e.g., an error redirect mid-stream); handle upstream failures before constructing the success response.
- Keep `package.json` free of runtime dependencies. The proxy must stay framework-free and build-free.
