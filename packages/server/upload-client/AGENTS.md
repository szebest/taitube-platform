# AGENTS.md — @vp/upload-client (server tier)

Instructions for any coding agent working on `packages/server/upload-client`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Reference CLI for resumable multipart uploads — the worked example of the three-step presigned upload flow.

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- **Layer T6** — above the applications, because the acceptance suite boots `apps/api` and a stub S3 to
  drive a real resumable upload end to end. What the package *ships* is `@vp/errors`, `@vp/result` and
  `@vp/storage`; the layer records the whole manifest, devDependencies included.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** its `pnpm` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file.

---

## 3. Local Commands

```bash
pnpm upload-client            # from the repo root
pnpm --filter @vp/upload-client typecheck
pnpm --filter @vp/upload-client test
```
