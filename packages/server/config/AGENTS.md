# AGENTS.md — @vp/config (Environment Configuration)

Instructions for any coding agent working on `@vp/config`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/config` is the single source of truth for runtime environment variable parsing and validation across all applications and worker stages.
- Validates configuration at process startup using **Zod**.
- Enforces safe defaults aligned with the local-first architecture.
- Any new environment variable MUST be defined here, added to `.env.example`, and documented in `docs/SDD.md` §16.

---

## 2. Invariants

- Keep `.env.example` 100% local (pointing to local MinIO, local Redis, local Postgres).
- Cloud overrides (Cloudflare R2, Neon, Sentry) must remain strictly optional.

---

## 3. Local Commands

```bash
pnpm --filter @vp/config typecheck
pnpm --filter @vp/config test
```
