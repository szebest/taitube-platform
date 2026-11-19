# AGENTS.md — @kit/dev-token (server tier)

Instructions for any coding agent working on `packages/platform/server/dev-token`.

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope

Ed25519 (EdDSA) JWT generator and a local standalone server. Mints the bearer tokens the API and the
e2e suite authenticate with. The library (`src/jwt.ts`: `mintToken`, `verifyToken`; `src/keys.ts`:
`getDevKeyPair`, `getDevJwks`) derives its key pair from the seed in a `DevTokenConfig` (`src/config.ts`); the app's
token verifier uses `getDevJwks`. `src/cli.ts` implements the `mint`, `verify`, `jwks` and `serve`
commands; the app's `pnpm dev-token` script runs them with its own `DevTokenConfig` (issuer, audience, key id, seed,
product name, routes and the clock). `serve` (`src/server.ts`, port 3002 on loopback only, started by the root `pnpm dev`)
serves the key set and `GET /token?persona=user|creator|creator2|moderator|admin`, the token of a demo persona
(`src/personas.ts`), which the client apps' persona switcher signs in with when a build sets
`VITE_DEMO_PERSONAS=true` (SDD §11).

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/platform/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- **Layer 2** (`vp.layer` in `package.json`, authoritative): the CLI logs through `@kit/logger` (layer 1),
  its only workspace dependency.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **No ambient clock.** `iat` and the expiry check read `config.now`, never `Date.now()`, so a spec fixes the time.
3. **Dual runtime (Rule 2):** its `pnpm` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
4. **1:1 tests (Rule 12):** every source file has a name-matching spec (`cli`, `jwt`, `keys`, `personas`, `server`).

---

## 3. Local Commands

```bash
pnpm dev-token            # from the repo root
pnpm --filter @kit/dev-token typecheck
pnpm --filter @kit/dev-token test
```

## Tokens and registries

None. A `DevTokenConfig` the caller passes to `mintToken`, `verifyToken`, `getDevJwks`, `serveDevTokens` and `run` carries the issuer, audience, key id, seed, product name, routes and the clock (`now`).
