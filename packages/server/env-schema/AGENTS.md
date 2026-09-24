# AGENTS.md — @vp/env-schema (The Environment Contract)

Instructions for any coding agent working on `@vp/env-schema`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/env-schema` declares every environment key the platform reads, as Zod schemas (`AppEnvSchema`,
`AppEnv` in `src/app-env.ts`), plus the `AppConfig` value shaped from them (`toAppConfig` in
`src/app-config.ts`, `inProcessAppConfig` in `src/in-process-config.ts`). It parses a plain
`Record<string, string | undefined>` and knows nothing about where that record came from.

Validating a live environment and reporting the failure belongs to `@vp/config` (`parseEnv`, `loadEnv`,
`loadEnvOrExit`), one layer up. Before the split the two
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
   example parses cleanly - asserted in `src/__tests__/app-env.test.ts`. Adding a key means adding it to both, plus
   `docs/SDD.md` (Rule 3).
3. **Defaults stay local-first (Rule 1).** Every default names `localhost` or a local literal; nothing
   points at a cloud host.
4. **Consumers read `AppConfig`, not `AppEnv`.** `toAppConfig(env)` shapes the parsed environment once:
   `kind: AdapterKind` is `ADAPTER_FAMILY`, never inferred from `NODE_ENV`, `auth` is a tagged union on
   `type` (`jwks` or `dev`) resolved once from `AUTH_MODE`, `cdn` is a `CdnBase` whose
   trailing slashes `asCdnBase` strips once, and buckets, limits and connections are grouped for the
   module that uses them. `inProcessAppConfig(overrides)` is what a test or an in-process app runs on:
   the in-memory family over the schema defaults, overrides merged in `AppConfig`'s own shape.
5. **A browser build variable is not an environment key.** `REACT_APP_*` is inlined by CRA at build
   time and no server process reads it, so it is declared in `apps/web/src/config/index.ts` and left
   commented in `.env.example`. Declaring it here is what put the whole schema in the frontend bundle.
6. **A default the wire contract also states comes from the package that owns it.** `PAGE_SIZE_DEFAULT`
   and `PAGE_SIZE_MAX` are imported from `@vp/pagination`, which `@vp/api-contracts` reads too, so the
   env default and the advertised page bound cannot drift. That edge, and `@vp/pagination` being layer 2, is
   why this package is layer 3 (its other dependencies, `@vp/domain`, `@vp/result` and `zod`, sit lower).
   `OTEL_TRACES_SAMPLER` is the same kind of edge: its names are `TraceSamplerName` from `@vp/observability`
   (layer 2), imported as a type only, so loading the schema loads no OpenTelemetry module.
7. **A secret has no default.** `SECRET_KEYS` (`DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `REDIS_PASSWORD`) are optional outside production and required in it, and a production boot refuses any
   secret or `*_URL` value holding a credential this repo ships for local use (`src/local-credentials.ts`), and
   any `ADMIN_TOKEN` at all. A default for one of them is public by construction;
   `tests/architecture/no-defaulted-secrets.test.ts` fails on it, and on URL userinfo in a default.
8. **Two schemas, named consumers.** `AppEnv` keys are read by `toAppConfig`; the keys in `platform-env.json` are handed
   to something else and name it (`src/platform-env.json`). Tuning with no key is a named constant in
   `src/tuning.ts`, declared once and folded into `AppConfig` by `toAppConfig` (the barrel does not export it);
   `tests/architecture/env-keys-consumed.test.ts` and `tests/architecture/no-tuning-literals.test.ts` hold both.

---

## 3. Local Commands

```bash
pnpm --filter @vp/env-schema typecheck
pnpm --filter @vp/env-schema test
```
