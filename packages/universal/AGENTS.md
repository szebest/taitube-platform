# AGENTS.md — packages/universal/ (runs in a browser AND on a server)

> The full tier and layer reference, including the per-package map and the recipes:
> [packages/AGENTS.md](../AGENTS.md)

---

## What belongs here

A package belongs in `universal/` when **something client-side actually imports it**. Not when it
*could* run in a browser — plenty of code is portable without any browser needing it.

Current members: `api-contracts`, `domain`, `domain-rules`, `errors`, `pagination`, `permissions`,
`result`, `tsconfig`, `validation`. `apps/web` reaches six of them at runtime (through `@vp/api-client`
plus its direct `@vp/permissions` and `@vp/result`); `domain-rules` and `validation` qualify through
`packages/client/api-client/src/__tests__/universal-rules.test.ts`, which runs both from the client tier.

`storage`, `job-contracts` and `events` live in `server/` because their only consumers are `apps/api`,
`apps/worker` and other server packages. `job-contracts` carries BullMQ queue names - backend vocabulary
with no place in the browser-safe tier.

`env-schema` is `server/` for a sharper reason: when it was universal, `apps/web` imported one URL default
from it, and that one import put `DATABASE_URL`, `S3_SECRET_ACCESS_KEY`, `ADMIN_TOKEN` and the BullMQ queue
names into `main.*.js`. One import is not a licence for the rest of the module.

**The test:** grep for importers. If none is `apps/web`, `packages/client/*` or another `universal`
package that itself reaches the client, it is `server/`. Then ask the same of every *export*: a module
whose bulk is server vocabulary is a server module however small the part the browser wants.

## Rules

1. **May depend on `universal` packages only.** Never `server`, never `client`. A `server` dependency
   here is what puts a Redis client in the browser bundle.
2. **No `node:*`, no `process`, no `Buffer`, no `NodeJS.*` types.** The `@vp/tsconfig/universal.json`
   preset sets `lib` with `DOM` and `types: []`, so these are compile errors, not review comments.
3. **Specs are typechecked separately.** `types: []` alone is not enough: the vitest globals a spec
   uses (`vitest/globals` in `@vp/tsconfig/spec.json`) pull `@types/node` into the program, and `node:fs`
   starts resolving again. Each package excludes its specs from `tsconfig.json` and typechecks them through a
   sibling `tsconfig.spec.json`. Keep that shape when adding a package.
4. **Relative imports are extensionless**, as in every tier. `apps/web` resolves them through the one
   webpack override in its `craco.config.js` (`resolve.fullySpecified: false` for workspace packages);
   never add an extension to make an import resolve, change the build instead.
5. Prefer a platform API over a dependency — `Intl`, `atob`/`btoa`, `URL` — since anything you add ships
   to the browser.
6. **Declare `"sideEffects": false`.** Without it webpack keeps every module the frontend touches whole,
   so an unused export still ships. `tests/architecture/frontend-vocabulary.test.ts` asserts it.

## Why it holds

pnpm links only declared dependencies, so an undeclared import does not resolve:
`error TS2307: Cannot find module '@vp/adapters'`. `pnpm boundaries` then catches the other half — someone
adding the declaration — and fails `pnpm build` and `pnpm typecheck` before turbo starts.
