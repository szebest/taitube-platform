---
name: vp-bullmq-pipeline
description: Implement and debug the video-pipeline job system on BullMQ 6 — queue topology (one queue per stage/rendition), deterministic job IDs with generations, Flow fan-out/fan-in, retry/backoff policies from packages/job-contracts, the dead-letter-queue pattern (BullMQ has none natively), stalled-job/lock-renewal semantics, graceful shutdown and worker concurrency rules. Use when adding a stage, changing job payloads, handling failures, or investigating stuck/duplicated jobs.
license: MIT
metadata:
  project: video-pipeline
  spec: docs/SDD.md §9, §20, ADR-03, ADR-16, ADR-18
---

# BullMQ pipeline patterns (project conventions)

Read `docs/SDD.md` §9 for the full design and §20 for the contracts code. Generic BullMQ API help lives in the `bullmq` skill; this one encodes *our* decisions.

## Topology and identity
- Queues: `probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`, `housekeeping`, `dlq`. Three transcode queues on purpose (independent KEDA sizing). **Queue names and job ids must not contain `:`** — BullMQ throws. Separator is `--`.
- Job ids are deterministic: `${videoId}--probe--g${generation}`, `${videoId}--transcode--720p--g${generation}`, `${videoId}--package--g${generation}`, notify `${videoId}--notify--${event}--${seq}`, replay suffix `--r${n}`. A duplicate `add()` with an existing id is a no-op — that is the first line of idempotency.
- `generation` bumps on every re-process so new jobs never collide with terminal ones.
- All payloads are zod schemas in `@vp/job-contracts`; `traceparent` is a required field (tracing); all job options come from `stagePolicies`/`defaultJobOptions` there — never inline `attempts`/`backoff` at a call site.

## Flow fan-out / fan-in (§9.3)
- `probe` creates one Flow: parent `package` (queue `package`) with children per ladder rung on their own queues plus `thumbnail`. Renditions: `failParentOnFailure: true`. Thumbnail: `ignoreDependencyOnFailure: true` (a missing sprite never blocks READY).
- Parent sits in `waiting-children`; `package` reads `await job.getChildrenValues()` for `TranscodeResult`s — no DB round-trip needed for fan-in.
- Re-running probe with the same ids adds no duplicate children.

## Worker process model (§9.4)
- One process = one `WORKER_STAGE` = one `Worker`. Transcode: `concurrency 1`, `lockDuration 120_000`; probe/package: 4, `60_000`; notify: 8 with `limiter {max:100, duration:10_000}`. `stalledInterval 30_000`, `maxStalledCount 2`.
- Lock renewal (`lockRenewTime = lockDuration/2`) **is** the heartbeat. Also write `processing_steps.heartbeat_at` on progress so a renewing-but-hung ffmpeg is visible; enforce a hard per-job timeout.
- `SIGTERM` → `worker.close()` (stop taking jobs, wait for the active one). Kubernetes grace period 900 s for transcodes. `tini` as PID 1.
- Runtime-neutral code: `ioredis` on both Node and Bun (`Bun.redis` is not BullMQ-compatible).

## Failure handling (§9.6, ADR-18)
- Classify at the throw site: `PermanentError` (extends BullMQ `UnrecoverableError`) → no retry; `TransientError` → retry with `exponential` backoff + `jitter: 0.5`; unknown → transient with cap 3.
- **DLQ pattern** (no native DLQ): in `worker.on('failed')`, when attempts are exhausted or the error is unrecoverable: insert `dlq_entries` (Postgres mirror, unique per queue/job/attempt), `add()` a `DlqJob` copy to the `dlq` queue (no consumer), mark `processing_steps DEAD`, `renditions FAILED`; with `failParentOnFailure` the video flips `FAILED` once and `notify` publishes `video.failed`. Keep `removeOnFail: {age: 7d}` so Bull Board still shows originals.
- Replay = re-add to the origin queue with `--r{n}` suffix + audit event; discard = mark `DISCARDED`. Admin-only.
- Systemic failure (> 50 % failing over 5 min): pause the queue (`queue.pause()`), fix the dependency, resume — do not burn attempts.

## Effectively-once, not exactly-once (§9.5, §9.7)
- Assume duplicate *execution* can happen (stalled re-queue, partitions). Make effects idempotent: deterministic object keys (overwrite same bytes), CAS state transitions, fencing token on the final `processing_steps` commit (`vp-postgres-cas-fencing` skill).
- Stalled jobs re-queued by BullMQ do **not** consume `attempts` the same way failures do — verify and log `stalledCounter` when debugging.

## Debugging checklist
1. `Queue.getJobCounts()` per queue; `getJobState(id)`; look for `waiting-children` parents with a failed child.
2. Redis `maxmemory-policy` must be `noeviction` and AOF on (`make check-redis`).
3. Bull Board (`/admin/queues`) → job → stack + last 50 ffmpeg stderr lines in the failure record.
4. `video_events` for the video tells the full story with `trace_id`s; follow into Tempo.
5. Reconciler (`housekeeping`) will re-enqueue `UPLOADED` videos without a probe step after 5 min — if you see "phantom" jobs, that is why (ADR-16).

## Schedulers
BullMQ 6 Job Schedulers (`queue.upsertJobScheduler(id, {pattern}, template)`) — upsert on API boot (idempotent); legacy `repeat` APIs are gone in v6. Cadence ≥ 15 min for reconcile so Neon can autosuspend in the cloud.
