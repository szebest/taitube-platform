# AGENTS.md — @vp/env-schema (The Environment Contract)

Instructions for any coding agent working on `@vp/env-schema`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/env-schema` declares every environment key the platform reads, as Zod schemas, plus the types
inferred from them and the `AppConfig` value shaped from them. It parses a plain
`Record<string, string | undefined>` and knows nothing about where that record came from.

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
4. **Consumers read `AppConfig`, not `AppEnv`.** `toAppConfig(env)` shapes the parsed environment once:
   `kind: AdapterKind` is derived from `NODE_ENV` here and nowhere else, `cdn` is a `CdnBase` whose
   trailing slashes `asCdnBase` strips once, and buckets, limits and connections are grouped for the
   module that uses them. `inProcessAppConfig(overrides)` is what a test or an in-process app runs on:
   the in-memory family over the schema defaults, overrides merged in `AppConfig`'s own shape.
5. **A browser build variable is not an environment key.** `REACT_APP_*` is inlined by CRA at build
   time and no server process reads it, so it is declared in `apps/web/src/config/index.ts` and left
   commented in `.env.example`. Declaring it here is what put the whole schema in the frontend bundle.
6. **A default the wire contract also states comes from the package that owns it.** `PAGE_SIZE_DEFAULT`
   and `PAGE_SIZE_MAX` are imported from `@vp/pagination`, which `@vp/api-contracts` reads too, so the
   env default and the advertised page bound cannot drift. That edge, and `@vp/pagination` being T2, is
   why this package is T3.
7. **A secret has no default.** `ADMIN_TOKEN`, `WEBHOOK_SIGNING_SECRET`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY` and `REDIS_PASSWORD` are optional outside production and required in it, and a
   production boot refuses the published `change-me` placeholder. A default for one of them is public by
   construction; `no-defaulted-secrets.test.ts` fails on it.

---

## 3. Local Commands

```bash
pnpm --filter @vp/env-schema typecheck
pnpm --filter @vp/env-schema test
```
