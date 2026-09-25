# @vp/worker

Asynchronous BullMQ worker runtime for the video-pipeline processing stages. [AGENTS.md](AGENTS.md) holds the
rules; this page is how to run one.

## Dual-Runtime Parity (SDD §2.3, ADR-01)
Worker stages run identically under:
- **Bun 1.4** (the image's default, `WORKER_RUNTIME=bun`)
- **Node.js 24** (`WORKER_RUNTIME=node` at image build)

Worker source uses `node:*` modules only, never a `Bun.*` API (`src/__tests__/runtime-parity.test.ts`).

## Architecture & Guarantees
- **Stage Registry:** `WORKER_STAGE` picks the stage from `STAGE_REGISTRY` in `src/registry.ts`.
- **One Queue per Stage:** decoupled concurrency, scaling and backoff per SDD §9.1.
- **Fencing Tokens:** a stage claims its `processing_steps` row with a UUIDv7 `lockToken` through `repositories.steps.claim(...)`, and `complete(...)` / `fail(...)` check the same token, so a zombie worker's commit is rejected (SDD §5.3, §9.5).
- **Graceful Shutdown:** `SIGTERM` / `SIGINT` run `shutdownOnce` from `@vp/composition`, installed before the worker starts.
- **Per-Job Temp Dirs:** created under `TMP_DIR` (default `/tmp/vp`) by `src/stages/scratch-dir.ts` and removed in a `finally`; the `tmp-sweep` housekeeping task removes one left behind.
- **Liveness Heartbeat:** `src/heartbeat.ts` writes integer epoch seconds to `WORKER_HEARTBEAT_PATH` (default `/tmp/vp/heartbeat`) every 15 s.

## Running a worker locally

### 1. Prerequisites
PostgreSQL, Redis and MinIO running (`make up`), and the worker built (`pnpm --filter @vp/worker build`).

### 2. Running with Node.js
```bash
WORKER_STAGE=probe pnpm --filter @vp/worker dev
```

### 3. Running with Bun
```bash
WORKER_STAGE=probe bun apps/worker/src/main.ts
```

### 4. Running tests under both runtimes
```bash
pnpm --filter @vp/worker test
pnpm --filter @vp/worker test:bun
```
