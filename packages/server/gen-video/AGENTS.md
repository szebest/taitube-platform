# AGENTS.md — @vp/gen-video (server tier)

Instructions for any coding agent working on `packages/server/gen-video`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Deterministic synthetic video fixture generator (FFmpeg). Produces bit-for-bit identical media matching the JSON manifest checksums.

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- Its `vp.layer` in `package.json` is authoritative; dependencies must point strictly down.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** its `pnpm` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file.

---

## 3. Local Commands

```bash
pnpm gen-video            # from the repo root
pnpm --filter @vp/gen-video typecheck
pnpm --filter @vp/gen-video test
```
