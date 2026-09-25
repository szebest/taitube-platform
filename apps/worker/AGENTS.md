# AGENTS.md — @vp/worker (BullMQ Processing Workers)

Instructions for any coding agent working on the Taitube distributed worker runtime (`apps/worker`).

---

## 1. Scope & Architecture

`apps/worker` executes asynchronous BullMQ processing stages across the video ingestion and transcoding pipeline.
- **Composition Root:** `composeWorker` in `apps/worker/src/runner.ts` composes one `Container` over the same `registerAdapters` (`@vp/adapters/composition`) the API uses, so `config.kind` is the only switch between adapter families; `registerStages` in `composition/stages.module.ts` binds the stage's processor to its queue as a Startable. `composeWorker` starts nothing.
- **Stage Registry:** `STAGE_REGISTRY` in `registry.ts` carries each stage's worker options and its processor factory, keyed by `config.worker.stage` (`WORKER_STAGE`). Adding a stage is one registry entry.
- **Configuration is a value:** `main.ts` hands a `ProcessHost` (`process.env`, signal hook, exit) to `run` in `process.ts`, which calls `loadEnv()` on its env and hands `toAppConfig()`'s result to `composeWorker`. Stages take buckets, the CDN base and ffmpeg settings from their deps; nothing below `main.ts` reads `process.env`.
- **Collaborators are values too:** a stage gets `metrics` and `media` (the FFmpeg processes, `MediaTools` from `@vp/ffmpeg`) in `StageDeps`, and a transcode gets its progress reporter and segment uploader as factories. A spec fails a stage by handing it a `MediaTools` double, never by spying on `@vp/ffmpeg`.

---

## 2. Invariants & Rules

### Rule 1: Dual-Runtime Compatibility (Strict Parity)
- Worker code must run identically under **Node.js 24 LTS** and **Bun 1.4+**.
- Runtime APIs come from `node:*` modules only (today `node:fs/promises` and `node:path`); everything else is a workspace package or `uuidv7`.
- **Strictly Forbidden:** Importing or using `Bun.*` proprietary APIs (`src/__tests__/runtime-parity.test.ts` checks).
- All worker tests must pass under both `vitest` and `bun test`.

### Rule 2: Fencing Tokens & CAS State Transitions
- A stage mints a UUIDv7 `lockToken` and claims its `processing_steps` row with `repositories.steps.claim(...)`; a `fenced` claim means the step already completed and the stage returns without work.
- `repositories.steps.complete(...)` / `fail(...)` check the same `lockToken`, rejecting a zombie worker whose job was re-queued (`StepRepository` in `@vp/core/repositories`).
- State transitions on `videos` execute via Compare-and-Set and atomically log audit records in `video_events`.

### Rule 3: The Consumer Is the Only Throw
- A stage returns `Result<T, E>` and decides nothing about retries (SDD ADR-24). `composition/stages.module.ts` converts:
  `if (isErr(outcome)) throw toPipelineError(outcome.error)`, because BullMQ's retry contract *is* the exception
  - a stage that returns normally is a completed job.
- `toPipelineError` lives in `@vp/errors` and reads `RETRY_CLASS`, so ADR-18's classification is decided once
  per code in the vocabulary and the throw site has no judgement left to make. Never classify by inspecting
  a message or a class name.
- **There is no unwrap helper.** `unwrapOrThrow` existed as a migration shim and is gone: it was a third
  unwrap site that neither ADR-24 nor this file's Rule 3 sanctioned. `no-domain-throw.test.ts` fails on a
  `throw`, an `*OrThrow(` helper and a throwing `Schema.parse(` / `JSON.parse(` in a stage.
- **A job's payload is parsed once, at the edge.** The registry reads each queue's contract with
  `safeParse` before the stage runs, and `instrument` validates the job id; a stage receives a typed job.
- The unknown-error default is unchanged: anything that escapes a stage as a raw throw is transient with an
  attempt cap of 3.
- Dual-runtime parity is unaffected: `@vp/result` is plain TypeScript with no `Bun.*` and no `node:*`.

### Rule 4: Bounded Temp File Cleanup
- FFmpeg work happens in a per-job directory from `createScratchDir(tmpRoot, prefix)` (`src/stages/scratch-dir.ts`), under `config.worker.tmpDir` (`TMP_DIR`, default `/tmp/vp`, a tmpfs in compose).
- The stage removes it with `removeScratchDir` in a `finally` (`probe.ts`, `thumbnail.ts`, `transcode.ts`); a directory left behind is removed by the `tmp-sweep` housekeeping task.

### Rule 5: Graceful Shutdown & Liveness
- `SIGTERM` and `SIGINT` run `shutdownOnce` from `@vp/composition`, the same drained shutdown as the API: the runner's container disposes in reverse construction order and a close that outlives the stage's `shutdownTimeoutMs` is abandoned with the pending disposer named. `shutdownTimeoutMs` is the pod's `terminationGracePeriodSeconds` less the 5 s preStop and a 5 s margin; `registry.test.ts` reads the manifests to hold them together.
- The handlers are installed before `start()`, so a signal while the worker boots drains too. `start()` runs the metrics server and the heartbeat before the consumer (`resolveStartOrder`, held by `tests/in-process/start-order.test.ts`), so a bound metrics port fails the boot before a job is taken.
- `Heartbeat` (`src/heartbeat.ts`) is the only writer of `WORKER_HEARTBEAT_PATH` (default `/tmp/vp/heartbeat`): integer epoch seconds and a newline, every 15 s (the `WORKER_HEARTBEAT_INTERVAL_MS` constant in `@vp/env-schema`'s `tuning.ts`). Liveness fails when the file is missing or 45 s old; readiness is `/readyz` on the metrics port, which asks the consume queue's Redis connection.

---

## 3. Dedicated Skills & References

- **`worker-pipeline-stages`**: Pipeline stage design, FFmpeg invocations, and fencing token flow.
- **`vp-bullmq-pipeline`**: BullMQ 6 topology, stalled jobs, retry policies.
- **`vp-ffmpeg-hls-ladder`**: FFmpeg command construction, keyframe alignment, HLS packaging.
- **Testing Standards:** `docs/standards/testing.md`.

---

## 4. Local Commands

```bash
# Run probe stage under Node (reads dist/, so build first with pnpm --filter @vp/worker build)
WORKER_STAGE=probe pnpm --filter @vp/worker dev

# Run transcode stage under Bun
WORKER_STAGE=transcode-720p bun apps/worker/src/main.ts

# Run tests under Vitest (Node)
pnpm --filter @vp/worker test

# Run tests under Bun
pnpm --filter @vp/worker test:bun
```
