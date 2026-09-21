# AGENTS.md — @vp/api-contracts (HTTP Contract, universal tier / T2)

Instructions for any coding agent working on `packages/universal/api-contracts`.

> Tiers, layers and the import rules in full: [docs/standards/package-boundaries.md](../../../docs/standards/package-boundaries.md)
---

## 1. Scope

The **single source of the HTTP contract** (SDD ADR-20). One Zod schema per endpoint: path params,
query, body, response and the error codes it may return. `apps/api` derives its Fastify route schemas
from here; `@vp/api-client` derives its typed fetchers from here. Neither re-declares a shape.

- **Tier `universal`** — this runs in a browser. No `node:*`, no server SDK, no `@types/node`.
  A Node builtin here is a compile error, not a review comment.
- **Layer T2** — may depend on T1 (`@vp/errors`) only.

---

## 2. Invariants

1. **Single-sourced, never parallel.** A route schema in `apps/api` that restates a shape instead of
   importing it is the defect this package exists to prevent.
2. **Drift fails the build.** `apps/api/src/__tests__/contract-drift.test.ts` asserts every registered
   Fastify route has a contract entry, every contract endpoint is routable, and the OpenAPI
   summary/description/tag come from the contract.
3. **One file per route group**, named after the group (`videos.ts`, `feed.ts`, `channels.ts`) — never
   after the artefact (`schemas.ts`, `types.ts`).
4. **Relative imports carry `.js`**, as `@vp/permissions` does, because CRA's webpack refuses
   extensionless ESM.
5. Every endpoint is registered in `index.ts` (`API_ENDPOINTS` / `findEndpoint`).

---

## 3. Adding an endpoint

Add the schema to its route-group file, register it in `index.ts`, then wire the route in `apps/api`
through `contractSchema(<contract>)`. The drift test tells you if you missed a step.

---

## 4. Local Commands

```bash
pnpm --filter @vp/api-contracts typecheck
pnpm --filter @vp/api-contracts test
pnpm --filter @vp/api-contracts build
```
