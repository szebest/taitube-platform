# AGENTS.md — @kit/compose-autoscaler (server tier)

Instructions for any coding agent working on `packages/platform/server/compose-autoscaler`.

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope

Queue-depth autoscaler daemon for local Docker Compose, mirroring what KEDA does in Kubernetes. It polls
the API's Prometheus queue metrics and runs
`docker compose --profile '*' up -d --scale <service>=N --no-recreate --no-deps <service>` per worker
stage (the workers sit behind the `worker` profile; naming the service keeps the other profiles stopped, and
`--no-deps` keeps compose from rerunning `migrate` and the seed on every scale step).
`src/scaler.ts` computes replicas, `src/runner.ts` (`ComposeAutoscaler`) runs the loop,
`src/cli.ts` parses arguments; `scripts/compose-autoscaler.ts` wires `child_process`, `fetch`, the clock and the process, and `scripts/compose-autoscaler-config.ts` holds this repo's `AutoscalerConfig` (metrics path and per-stage defaults).

This is a **workspace package with a CLI**, not a loose script — which is why it lives under
`packages/platform/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`** — Node/Bun only.
- **Layer 2** (`vp.layer` in `package.json`, authoritative): it logs through `@kit/logger` (layer 1), its
  only workspace dependency.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **No ambient read.** The host hands it the env record and `now`; nothing here reads `process.env` or the
   clock itself, so a spec drives every poll with the time it chooses.
3. **Dual runtime (Rule 2):** its `pnpm` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
4. **Tests where behaviour can break:** specs in `src/__tests__/` cover the logic, branches and error paths, under the repo's 85% coverage floor; no spec is required per source file (`docs/standards/testing.md`).

---

## 3. Local Commands

```bash
pnpm compose-autoscaler            # from the repo root
pnpm --filter @kit/compose-autoscaler typecheck
pnpm --filter @kit/compose-autoscaler test
```

## Tokens and registries

None. An `AutoscalerConfig` the caller passes to `run` carries the metrics path and the default stage table.
