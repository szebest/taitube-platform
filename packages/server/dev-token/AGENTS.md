# AGENTS.md — @vp/dev-token (server tier)

Instructions for any coding agent working on `packages/server/dev-token`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Ed25519 (EdDSA) JWT generator and a local standalone JWKS server. Mints the bearer tokens the API and the
e2e suite authenticate with. The library (`src/jwt.ts`: `mintToken`, `verifyToken`; `src/keys.ts`:
`getDevKeyPair`, `getDevJwks`, `DEV_KEY_ID`) derives its key pair from a fixed seed; `@vp/adapters` uses
`getDevJwks` for its `DevTokenVerifier`. `src/cli.ts` implements the `mint`, `verify`, `jwks` and `serve`
commands and `src/main.ts` runs them.

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- **Layer 2** (`vp.layer` in `package.json`, authoritative): the CLI logs through `@vp/logger` (layer 1),
  its only `@vp/*` dependency.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** its `pnpm` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
3. **1:1 tests (Rule 12):** every source file has a name-matching spec. `cli.ts` and `main.ts` do; `jwt.ts`
   and `keys.ts` are still covered together by `src/__tests__/dev-token.test.ts` and listed in the shrink-only
   `tests/architecture/untested-sources.ts`.

---

## 3. Local Commands

```bash
pnpm dev-token            # from the repo root
pnpm --filter @vp/dev-token typecheck
pnpm --filter @vp/dev-token test
```
