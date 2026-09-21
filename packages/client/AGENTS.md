# AGENTS.md — packages/client/ (browser only)

> The full tier and layer reference, including the per-package map and the recipes:
> [packages/AGENTS.md](../AGENTS.md)

---

## What belongs here

Browser-only libraries: code that needs the DOM, `window`, or browser-only APIs, and that no server
process imports. If both a browser and a server need it, it is `universal/`, not here.

Current member: `api-client`.

## Rules

1. **May depend on `universal` and `client` packages.** Never `server` — `client` and `server` are
   siblings that can never see each other, which is the invariant the whole scheme protects.
2. **No `node:*`, no `process`, no `Buffer`.** The `@vp/tsconfig/client.json` preset gives `lib` with
   `DOM` and `types: []`, so these are compile errors.
3. **Nothing is hand-written that a contract already owns.** `@vp/api-client` derives every fetcher from
   the `@vp/api-contracts` registry, so an endpoint cannot exist in the client without existing in the
   contract. Keep that property for anything added here.
4. **No host literals.** URLs are injected from config — a hardcoded host breaks local-first (Rule 1) and
   is asserted against.
5. **Relative imports carry `.js`** for CRA's webpack.

## Bundle awareness

Everything here ships to a user's browser. Prefer a platform API over a dependency, and check what a
package pulls in transitively before adding it — `pnpm why <pkg>` from `apps/web` is the quick check.
`apps/web`'s runtime closure is six packages today, every one of them `universal` or `client`; keep it small.
