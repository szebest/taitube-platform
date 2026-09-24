# AGENTS.md — @vp/compose-autoscaler (server tier)

Instructions for any coding agent working on `packages/server/compose-autoscaler`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Queue-depth autoscaler daemon for local Docker Compose, mirroring what KEDA does in Kubernetes. It polls
the API's Prometheus queue metrics and runs `docker compose up -d --scale <service>=N --no-recreate` per
worker stage. `src/scaler.ts` computes replicas, `src/runner.ts` (`ComposeAutoscaler`) runs the loop,
`src/cli.ts` parses arguments and `src/main.ts` wires `child_process`, `fetch` and the process.

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- **Layer 2** (`vp.layer` in `package.json`, authoritative): it logs through `@vp/logger` (layer 1), its
  only `@vp/*` dependency.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** its `pnpm` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file (`src/__tests__/<name>.test.ts`).

---

## 3. Local Commands

```bash
pnpm compose-autoscaler            # from the repo root
pnpm --filter @vp/compose-autoscaler typecheck
pnpm --filter @vp/compose-autoscaler test
```
