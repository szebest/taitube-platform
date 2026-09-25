# 06: Worker runtime + `probe` stage — good files become `PROCESSING`, hostile files become `FAILED`

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Issue | [#6](https://github.com/szebest/taitube-platform/issues/6) |
| Size | L |
| Blocked by | 05 — Upload slice · 03 — Dev tooling (fixtures) |
| Blocks | 07, 17 |
| Spec | [PRD US-6, US-8](../PRD.md#52-processing) · [PRD FR-3, FR-12](../PRD.md#6-functional-requirements) · [SDD §2.2 Components](../SDD.md#22-components-and-responsibilities) · [SDD §2.3 Runtime split](../SDD.md#23-runtime-split--why-two-runtimes) · [SDD §8.1 Probe](../SDD.md#81-probe) · [SDD §9.4 Worker process model](../SDD.md#94-worker-process-model) · [SDD §9.5 Long-running jobs](../SDD.md#95-long-running-jobs-heartbeats-crashes-double-processing) · [SDD §9.7 Idempotency](../SDD.md#97-idempotency-guarantees-per-step) · [ADR-01](../SDD.md#adr-01--primary-language--runtime-typescript-node-lts-api--bun-workers) · [ADR-18](../SDD.md#adr-18--error-taxonomy-decides-retry-policy) |

**Status:** done

## What to build
After 05 enqueues a `probe` job, a worker process started with `WORKER_STAGE=probe` picks it up, runs ffprobe on the source, validates it, computes the rendition ladder (never upscaling), and moves the video `UPLOADED → PROBING → PROCESSING` with duration/dimensions/fps/codecs/ladder stored and pending `renditions` rows created. A hostile file (truncated, audio-only, over-duration…) moves to `FAILED` with the correct `error_code` **on the first attempt** — no retries. This lands the worker runtime (stage registry driven by `WORKER_STAGE`, one BullMQ `Worker` per process, lock renewal as heartbeat, graceful `SIGTERM` drain, per-job temp dir with guaranteed cleanup, heartbeat file for liveness, fencing-token claim/complete, structured logging with `videoId/jobId/attempt`), `packages/ffmpeg` probe/validation/ladder, and the `packages/observability` skeleton (metrics registry with every §13.1 name declared, pino factory, no-op OTel bootstrap).

## Acceptance criteria
- [x] `WORKER_STAGE=probe bun apps/worker` (and `node`) processes the job from 05: `s60` → `PROCESSING`, `duration_ms≈60000`, ladder `[1080p,720p,480p]`; `p720` → ladder `[720p,480p]`; `sd360` → `[480p]`; `portrait` → dimensions rotation-aware; `renditions` rows `PENDING` per ladder entry; `video_events` has `probe.started`/`probe.completed`.
- [x] Hostile fixtures → `FAILED` with `CORRUPT_CONTAINER` (truncated, audio-only, zero-bytes, not-a-video), `UNSUPPORTED_CODEC` only for codecs outside the allowlist (HEVC is allowed as *input*), `DURATION_EXCEEDED` (over-duration); `attemptsMade = 1`; job in BullMQ `failed` set (DLQ queue comes in 16).
- [x] A deleted source object → `PermanentError('SOURCE_MISSING')`, no retry.
- [x] `processing_steps` row claimed with `lock_token`, `heartbeat_at` updated, finished with the same token; a second claim (simulated retry) issues a new token and the old one is fenced on completion.
- [x] `SIGTERM` during a job: worker stops taking new jobs, finishes the active one, exits 0; temp dir removed on every exit path (success, throw, signal).
- [x] Unknown queue name or a `:` in a job id fails fast at boot/enqueue with a clear message.
- [x] Same test suite green under Bun and Node (CI job from 02).

## Out of scope
Transcoding (07), Flow creation (12 — for now probe enqueues nothing further; 07 adds a single `transcode-720p` follow-up).

## Notes for the implementer
- Worker code stays runtime-neutral (`node:child_process`, `node:fs`), no `Bun.*` APIs.
- Worker options per SDD §9.1/§9.4: probe concurrency 4, `lockDuration 60 s`, `stalledInterval 30 s`, `maxStalledCount 2`; all job options come from `packages/job-contracts`, never inline.
- If `@opentelemetry/auto-instrumentations-node` misbehaves on Bun, make it conditional and record the finding in this ticket — 23 depends on the answer.

## Testing plan
Integration: Testcontainers Redis+Postgres+MinIO, upload fixture via 05's script, run the worker in-process, assert DB state; unit for ladder selection and validation; run under both runtimes.

## Open questions
- Ladder rule for portrait sources (rank by short side?) — implement the SDD's rotation-aware rule and document the choice in code.

## Definition of Done
- [x] AC green on both runtimes; README section "Running a worker locally".
