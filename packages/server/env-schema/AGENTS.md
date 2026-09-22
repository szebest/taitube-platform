# AGENTS.md — @vp/env-schema (The Environment Contract)

Instructions for any coding agent working on `@vp/env-schema`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/env-schema` declares every environment key the platform reads, as Zod schemas, plus the types
inferred from them. It parses a plain `Record<string, string | undefined>` and knows nothing about where
that record came from.

Reading `process.env`, printing the failure and exiting belongs to `@vp/config`. Before the split the two
lived in one file and the boundary was drawn at runtime by `typeof process !== 'undefined'` — a
feature-detect standing in for a tier.

The package is `server` because every key it declares is one: Postgres, Redis, S3, auth, the BullMQ queue
names. It was `universal` while `apps/web` read one URL default from it, and the rest of the module went
into `main.*.js` with it — a tier rule cannot see inside a package it has already allowed. `apps/web`
declares its own default now.

---

## 2. Invariants

1. **Nothing here touches a runtime.** No `process`, no `node:*`, no I/O, no `typeof` guard standing in
   for a boundary. This package describes the environment; it never reads one.
2. **`.env.example` is the schema's mirror.** Every key in one exists in the other, and the unmodified
   example parses cleanly — asserted in this package's spec. Adding a key means adding it to both, plus
   `docs/SDD.md` (Rule 3).
3. **Defaults stay local-first (Rule 1).** Every default names `localhost` or a local literal; nothing
   points at a cloud host.
4. **A default two server packages need is a named constant** — `DEFAULT_CDN_BASE_URL`,
   `DEFAULT_API_BASE_URL` — so the schema and the consumer cannot drift apart. A browser default is not
   one of those: exporting it from here is what put the whole schema in the frontend bundle.
5. **A default the wire contract also states comes from the package that owns it.** `PAGE_SIZE_DEFAULT`
   and `PAGE_SIZE_MAX` are imported from `@vp/pagination`, which `@vp/api-contracts` reads too, so the
   env default and the advertised page bound cannot drift. That edge is why this package is T2, not T1.

---

## 3. Local Commands

```bash
pnpm --filter @vp/env-schema typecheck
pnpm --filter @vp/env-schema test
```
