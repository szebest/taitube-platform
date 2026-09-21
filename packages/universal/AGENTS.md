# AGENTS.md — packages/universal/ (runs in a browser AND on a server)

> The full tier and layer reference, including the per-package map and the recipes:
> [packages/AGENTS.md](../AGENTS.md)

---

## What belongs here

A package belongs in `universal/` when **something client-side actually imports it**. Not when it
*could* run in a browser — plenty of code is portable without any browser needing it.

Current members: `api-contracts`, `domain`, `errors`, `pagination`, `permissions`, `tsconfig`.

`storage`, `job-contracts` and `events` were once declared universal and are now `server/`, because
their only consumers were `apps/api` and `apps/worker`. `job-contracts` carries BullMQ queue names —
backend vocabulary that had no business in the browser-safe tier.

`domain` and `pagination` came the other way: they were 38 of the 39 files in a `server` `core/` that
one `Buffer`-typed port pinned to the backend. `@vp/api-contracts` consumes both — the status
vocabulary and the cursor codec — and each move deleted a copy the frontend had been keeping.

**The test:** grep for importers. If none is `apps/web`, `packages/client/*` or another `universal`
package that itself reaches the client, it is `server/`.

## Rules

1. **May depend on `universal` packages only.** Never `server`, never `client`. A `server` dependency
   here is what puts a Redis client in the browser bundle.
2. **No `node:*`, no `process`, no `Buffer`, no `NodeJS.*` types.** The `@vp/tsconfig/universal.json`
   preset sets `lib` with `DOM` and `types: []`, so these are compile errors, not review comments.
3. **Specs are typechecked separately.** `types: []` alone is not enough: a spec doing
   `import { describe } from 'vitest'` pulls `@types/node` into the whole program and `node:fs` starts
   resolving again. Each package excludes its specs from `tsconfig.json` and typechecks them through a
   sibling `tsconfig.spec.json`. Keep that shape when adding a package.
4. **Relative imports carry `.js`**, because CRA's webpack refuses extensionless ESM.
5. Prefer a platform API over a dependency — `Intl`, `atob`/`btoa`, `URL` — since anything you add ships
   to the browser.

## Why it holds

pnpm links only declared dependencies, so an undeclared import does not resolve:
`error TS2307: Cannot find module '@vp/adapters'`. `pnpm boundaries` then catches the other half — someone
adding the declaration — and fails `pnpm build` and `pnpm typecheck` before turbo starts.
