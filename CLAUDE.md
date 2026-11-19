# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first — it is the single source of truth for engineering guidance in this repo.** It covers the project's shape (single-file, zero-dependency proxy), the request pipeline, conventions (error funnel, logging redaction, the naming contract), common tasks, and traps — including why the repo must not be casually modularized/TS-ified (a prior attempt crashed production) and why `git add -A` is dangerous here.

Before any change: run `git status --short`, and read the current `README.md`, `vercel.json`, and `api/github-raw.js` — the three must always describe the same outward-facing contract.
