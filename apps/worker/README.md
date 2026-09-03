# @vp/worker

Asynchronous BullMQ worker runtime for the video-pipeline processing stages.

## Dual-Runtime Parity (SDD §2.3, ADR-01)
Worker stages and processors are runtime-neutral and run identically under:
- **Node.js 24 LTS** (production base)
- **Bun 1.4+** (high-throughput execution)

No `Bun.*` proprietary APIs are used in worker source code (`node:*` standard library only).

## Architecture & Guarantees
- **Stage Registry:** Driven by `WORKER_STAGE` environment variable.
- **One Queue per Stage:** Decoupled concurrency, scaling, and backoff per SDD §9.1.
- **Fencing Tokens:** Step claims and completions use `lock_token` UUIDs via `claimStep` and `completeStep` to reject zombie workers (SDD §5.3, §9.5).
- **Graceful Shutdown:** `SIGTERM` / `SIGINT` drain active jobs with bounded timeout before exiting.
- **Per-Job Temp Dirs:** Created in `os.tmpdir()` and guaranteed cleaned up on every exit path.
- **Liveness Heartbeat:** Writes timestamp to `WORKER_HEARTBEAT_PATH` (defaults to `/tmp/worker-heartbeat`).

## Running a worker locally

### 1. Prerequisites
Ensure PostgreSQL, Redis, and MinIO are running (e.g. via `make up`).

### 2. Running with Node.js
```bash
# Run probe stage
WORKER_STAGE=probe pnpm --filter @vp/worker dev

# Or directly with node
WORKER_STAGE=probe node --env-file=.env apps/worker/dist/main.js
```

### 3. Running with Bun
```bash
WORKER_STAGE=probe bun apps/worker/src/main.ts
```

### 4. Running tests under both runtimes
```bash
# Vitest (Node)
pnpm --filter @vp/worker test

# Bun test
pnpm --filter @vp/worker test:bun
```
