# AGENTS.md — packages/client/ (browser only)

> The full tier and layer reference, including the per-package map and the recipes:
> [packages/AGENTS.md](../AGENTS.md)

---

## What belongs here

Browser-only libraries: code that needs the DOM, `window`, or browser-only APIs, and that no server
process imports. If both a browser and a server need it, it is `universal/`, not here.

Current members: `api-client`, `intl-react`.

## Rules

1. **May depend on `universal` and `client` packages.** Never `server` — `client` and `server` are
   siblings that can never see each other, which is the invariant the whole scheme protects.
2. **No `node:*`, no `process`, no `Buffer`.** The `@vp/tsconfig/client.json` preset gives `lib` with
   `DOM` and `types: []`, so these are compile errors.
3. **Nothing is hand-written that a contract already owns.** `@vp/api-client` derives every fetcher from
   the `@vp/api-contracts` registry, so an endpoint cannot exist in the client without existing in the
   contract. Keep that property for anything added here.
4. **No host literals.** The base URL is injected (`apps/web/src/base-api.ts` passes `API_BASE_URL`); a
   hardcoded external host breaks local-first (Rule 1) and fails `tests/architecture/local-first.test.ts`.
5. **Relative imports are extensionless**, as in every tier. `apps/web` resolves them through the one
   webpack override in its `craco.config.js` (`resolve.fullySpecified: false` for workspace packages).
6. **Declare `"sideEffects": false`**, or webpack keeps every module the frontend touches whole and an
   unused export still ships. `tests/architecture/frontend-vocabulary.test.ts` asserts it.

## Bundle awareness

Everything here ships to a user's browser. Prefer a platform API over a dependency, and check what a
package pulls in transitively before adding it — `pnpm why <pkg>` from `apps/web` is the quick check.
`apps/web`'s runtime closure is ten workspace packages today (`@vp/api-client`, `@vp/intl-react` and eight
`universal` ones); keep it small.
Membership is not the whole check — `@vp/env-schema` was `universal`, and one URL default the browser
imported carried `DATABASE_URL`, `S3_SECRET_ACCESS_KEY` and the BullMQ queue names into `main.*.js` with it.
