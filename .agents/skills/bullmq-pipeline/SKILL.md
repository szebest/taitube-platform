---
name: bullmq-pipeline
description: >-
  Designing and debugging a staged job pipeline on BullMQ: queue topology, deterministic job
  ids, flows for fan-out and fan-in, retry classes, a dead-letter queue, stalled jobs,
  shutdown, production Redis. Use when adding a stage, changing a job payload, handling job
  failures, or chasing stuck or duplicated jobs.
license: MIT
---

# BullMQ pipeline

The design decisions for a pipeline of stages on BullMQ. API reference: the `bullmq` skill.
This repo's queues, ids, policies and numbers: `references/this-repo.md`.

## Topology and identity

- **One queue per stage**, and one per resource class when stages scale independently (one
  queue per output size, so each scales on its own depth).
- **Queue names and job ids never contain `:`**: BullMQ uses it as its key separator and
  throws. Pick another separator once (`--`).
- **Job ids are deterministic**: built from the entity id, the stage and a generation
  counter. Adding a job whose id exists is a no-op, which is the first line of idempotency.
  The generation bumps on every reprocess, so new jobs never collide with finished ones; a
  replay of a dead job adds a suffix.
- **Payloads are schemas in one contracts package**, validated on both sides; trace context
  travels as a required field. Retry and retention options come from one policy table,
  never written inline at a call site.

## Fan-out and fan-in with flows

- A flow's parent waits in `waiting-children` until its children finish, then reads their
  results with `job.getChildrenValues()`: no database round-trip for the fan-in.
- A required child gets `failParentOnFailure: true`; an optional one (a thumbnail, a
  preview) gets `ignoreDependencyOnFailure: true`, so it never blocks the parent.
- Re-running the producer with the same ids adds no duplicate children.

## Workers

- **One process, one stage, one `Worker`**: concurrency set per stage by the resource it
  burns (one for CPU-bound work, more for I/O).
- **The lock is the heartbeat**: `lockDuration` exceeds the longest gap between renewals.
  Work that hangs while the lock keeps renewing (a stuck child process) is caught by the
  stage's own heartbeat and a hard per-job timeout.
- **Connections**: a worker's Redis connection sets `maxRetriesPerRequest: null` and keeps
  its offline queue; a producer disables the offline queue so an enqueue fails fast. Every
  `Worker` and `Queue` has an `error` listener.
- **Shutdown**: `SIGTERM` and `SIGINT` call `worker.close()`, which stops taking jobs and
  waits for the active one. The container's grace period covers the longest job, and an
  init process runs as PID 1 so signals arrive.
- **Redis**: `maxmemory-policy noeviction` and AOF on; an evicted key is a lost job.
- **Retention**: keep few completed jobs and more failed ones. Job data sits in Redis in
  clear text: no secrets in a payload.

## Failures

- **Classify at the throw site**: a permanent error extends BullMQ's `UnrecoverableError`
  and never retries; a transient one retries with exponential backoff and jitter; an
  unknown one is transient with a low attempt cap.
- **Dead-letter queue**, which BullMQ does not have: in the worker's `failed` handler, when
  attempts are exhausted or the error is unrecoverable, record the failure durably (unique
  per queue, job and attempt, so the handler is idempotent), add a copy to a `dlq` queue
  nobody consumes, and mark the domain state failed. Keep the original's failed job for
  the dashboard.
- **Replay** re-adds to the origin queue under a suffixed id, with an audit record;
  **discard** marks the entry. Both are admin-only.
- **Systemic failure** (most jobs of a stage failing): pause the queue, fix the dependency,
  resume. Retrying into an outage only burns attempts.

## Effectively-once, never exactly-once

- Assume duplicate execution: a stalled job is re-queued while its first worker may still
  be running. Make every effect idempotent: deterministic storage keys (the same bytes to
  the same key), compare-and-set state transitions, a fencing token on the final commit
  (`postgres-cas-fencing`).
- Keep a job atomic: a database write and an external call in one job retry together;
  split them into stages of a flow.
- A stalled re-queue does not consume `attempts` the way a failure does: log
  `stalledCounter` when debugging.

## Schedulers

Recurring work uses job schedulers (`queue.upsertJobScheduler(id, { pattern }, template)`),
upserted on boot, which is idempotent; the legacy `repeat` options are gone.

## Debugging checklist

1. `queue.getJobCounts()` per queue and `queue.getJobState(id)`; a parent stuck in
   `waiting-children` usually has a failed child.
2. Redis eviction policy and persistence (above).
3. The dashboard's failed job: stack, attempts, the tail of the child process's stderr.
4. The entity's event log and trace ids, followed into the tracing backend.
5. A reconciler that re-enqueues stuck entities explains "phantom" jobs.

## Tests that must exist

Redis down at startup, a disconnect mid-job, shutdown with an active job (it finishes, no
new one starts), a duplicate `add()` with the same id, a stalled job finishing twice with
one committed result.
