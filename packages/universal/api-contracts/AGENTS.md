# AGENTS.md — @vp/api-contracts (HTTP Contract, universal tier / T3)

Instructions for any coding agent working on `packages/universal/api-contracts`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

The **single source of the HTTP contract** (SDD ADR-20). One `defineEndpoint({...})` per endpoint
(`endpoint.ts`): method, path, OpenAPI tag/summary/description, Zod schemas for params, query, body and
result, and the error codes it may return per status. It also owns the RFC 9457 `Problem` shape and
`PROBLEM_CONTENT_TYPE` (`problem.ts`), `problemFor` (`problem-for.ts`) and the cursor and page-limit
schemas (`pagination.ts`). `apps/api` derives its Fastify route schemas
from here; `@vp/api-client` derives its typed fetchers from here. Neither re-declares a shape.

- **Tier `universal`** — this runs in a browser. No `node:*`, no server SDK, no `@types/node`.
  A Node builtin here is a compile error, not a review comment.
- **Layer T3** - depends on `@vp/domain` and `@vp/errors` (T1), `@vp/pagination` (T2) and `zod`.

---

## 2. Invariants

1. **Single-sourced, never parallel.** A route schema in `apps/api` that restates a shape instead of
   importing it is the defect this package exists to prevent.
2. **Drift fails the build.** `apps/api/src/__tests__/contract-drift.test.ts` asserts every registered
   Fastify route has a contract entry, every contract endpoint is routable, and the OpenAPI
   summary/description/tag come from the contract.
3. **One file per route group**, named after the group (`videos.ts`, `feed.ts`, `channels.ts`) - never
   after the artefact (`schemas.ts`, `types.ts`). The shared modules (`endpoint.ts`, `problem.ts`,
   `problem-for.ts`, `pagination.ts`, `video-resource.ts`) are the only files that are not a route group.
4. **Relative imports are extensionless**, as in every tier (`esm-specifiers.test.ts`).
5. Every route group is registered in `index.ts` as a namespace import in `contracts`;
   `@vp/api-client` builds one fetcher per `defineEndpoint` export it finds there.

---

## 3. Adding an endpoint

Export a `defineEndpoint` from its route-group file (a new group also needs its `export *` and its slot
in `contracts` in `index.ts`), then wire the route in `apps/api` through `contractSchema(<contract>)`
from `apps/api/src/routes/contract-schema.ts`. The drift test tells you if you missed a step.

---

## 4. Local Commands

```bash
pnpm --filter @vp/api-contracts typecheck
pnpm --filter @vp/api-contracts test
pnpm --filter @vp/api-contracts build
```
