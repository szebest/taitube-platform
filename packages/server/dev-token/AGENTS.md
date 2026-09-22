# AGENTS.md — @vp/dev-token (server tier)

Instructions for any coding agent working on `packages/server/dev-token`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Ed25519 JWT generator and a local standalone JWKS mock server. Mints the bearer tokens the API and the e2e suite authenticate with.

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- Its `vp.layer` in `package.json` is authoritative; dependencies must point strictly down.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** must run cleanly under both `tsx` (Node) and `bun`.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file.

---

## 3. Local Commands

```bash
pnpm dev-token            # from the repo root
pnpm --filter @vp/dev-token typecheck
pnpm --filter @vp/dev-token test
```
