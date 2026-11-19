# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first — it is the single source of truth for engineering guidance in this repo.** It covers the project's tech shape, request pipeline, module boundaries, the external compatibility contract (env vars, query params, error redirects, caching), common tasks, and traps (streaming red lines, header whitelists, logging rules).

Before any change here, also check `git status --short` and read the current `README.md`, `vercel.json`, and `api/index.ts`: the three must always describe the same outward-facing contract.
