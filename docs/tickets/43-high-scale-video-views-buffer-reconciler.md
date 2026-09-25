# 43: High-scale video views buffer (Redis batch flush) & creator studio analytics

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#43](https://github.com/szebest/taitube-platform/issues/43) |
| Size | L |
| Blocked by | 38 — User & channel identity |
| Blocks | 44, 45, 65 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §9.4 Worker process model](../SDD.md#94-worker-process-model) · [SDD §9.8 Housekeeping schedulers](../SDD.md#98-housekeeping-job-schedulers) |

**Status:** in-progress

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Ticket 84 note:** every service this ticket adds returns `Result<T, …>` from `@vp/result` and throws
> nothing. Its pure checks split by what they need: input-only predicates go to `@vp/validation`,
> entity-dependent decisions to `@vp/domain-rules` — both `universal`, so the frontend runs the identical
> function. Routes unwrap with `sendResult`, and any new error code lands in `ErrorCodes`,
> `PROBLEM_STATUS` **and** `RETRY_CLASS`. See [84](84-result-typed-error-handling-shared-domain-rules.md).

## What to build

Directly incrementing a video's view counter in PostgreSQL (UPDATE videos SET views = views + 1 WHERE id = ) on every playback event saturates database locks and crashes the DB under heavy traffic.

This ticket delivers:
1. **Redis-Buffered View Ingestion & Anti-Fraud Engine**:
   - `POST /v1/videos/:id/views` registers playback telemetry (session UUID, watch duration, client timestamp).
   - **Anti-Fraud Filter**: Discards synthetic bots or pings with watch time < 5s.
   - **HyperLogLog Viewer Deduplication**: Uses Redis HyperLogLog (`taitube:views:dedup:{videoId}:{YYYYMMDD}`) with a 24-hour sliding TTL. Constant 12 KB memory footprint per video for millions of unique viewers.
   - **Atomic View Buffer**: Increments dirty video view counts via Redis Hash `taitube:views:buffer` (`HINCRBY taitube:views:buffer {videoId} 1`) returning `202 Accepted` in < 2ms without holding database connections.
2. **Zero-Loss Atomic Drain Reconciler (BullMQ & Lua Script)**:
   - Reconciler worker runs periodically (every 5–15s).
   - Executes atomic Redis Lua script to swap and snapshot `taitube:views:buffer` to `taitube:views:flush:{batchId}` without race conditions or lost increments.
   - Consolidates updates and executes a high-throughput multi-row PostgreSQL `UPDATE videos` query using SQL `VALUES (...)` tuples and transactional `INSERT INTO video_views_daily ... ON CONFLICT DO UPDATE`.
3. **Resilient Circuit Breaker & Fallback**:
   - If Redis is degraded, gracefully fails over to in-process memory ring-buffer without dropping client view beacons or throwing 500 errors.
4. **Creator Studio High-Scale Analytics API**:
   - `GET /v1/creator/videos/:id/analytics`: Views timeline with date bucketing (last 7, 30, 90 days), total views, average retention.
   - `GET /v1/creator/channel/analytics`: Aggregated channel views metrics, daily velocity, top-performing videos.

## Acceptance criteria

- [x] Database migration creating `video_views_daily`:
  - `video_id UUID not null references videos.id on delete cascade, view_date date not null, views integer not null default 0`.
  - Primary key `(video_id, view_date)` with composite index on `(view_date DESC, video_id)`.
- [x] Add `views_count bigint not null default 0` to `videos` table with index.
- [x] `ViewBufferPort` in `@taitube/core/ports/view-buffer.port.ts` and `RedisViewBufferAdapter` in `adapters/redis/redis-view-buffer.adapter.ts`.
- [x] `POST /v1/videos/:id/views` endpoint:
  - Validates telemetry payload with Zod schema (sessionId, watchSeconds, videoDuration).
  - Evaluates HyperLogLog deduplication (`PFADD taitube:views:dedup:{videoId}:{date} {sessionId}`).
  - Buffers increment in Redis, returning `202 Accepted` immediately (< 5ms p99 latency).
- [x] BullMQ scheduled job `flush-video-views`:
  - Runs on worker reconciler schedule (every 10s).
  - Drains snapshot key atomically, executes batched PostgreSQL update in single transaction:
    ```sql
    UPDATE videos AS v
    SET views_count = v.views_count + b.delta
    FROM (VALUES ($1::uuid, $2::bigint), ...) AS b(video_id, delta)
    WHERE v.id = b.video_id;
    ```
  - Upserts daily metrics into `video_views_daily`.
  - Clears flushed batch key on successful commit.
- [x] Creator analytics endpoints:
  - `GET /v1/creator/videos/:id/analytics`: Requires creator ownership. Returns daily views timeseries and summary stats.
  - `GET /v1/creator/channel/analytics`: Aggregated channel views metrics.
- [x] Concurrency & resilience tests:
  - Simulating 10,000 rapid view requests produces 0 database lock timeouts and exact consolidated view count in Postgres.
  - Simulated worker restart mid-batch recovers uncommitted snapshot without view counter loss.

## Out of scope

- Complex geographic IP geolocation analytics (rely on simple client payload for now).

## Notes for the implementer

- **Atomic Redis Lua buffer snapshot script:**
  ```lua
  -- Atomic swap buffer to batch key
  local bufferKey = KEYS[1]
  local batchKey = KEYS[2]
  if redis.call('EXISTS', bufferKey) == 1 then
    redis.call('RENAME', bufferKey, batchKey)
    return 1
  end
  return 0
  ```
- File length limit: <= 250 lines per file.

## Testing plan

- Unit tests for deduplication filter logic.
- Worker flush integration test: Seed Redis buffer, trigger reconciler job, assert PostgreSQL table values updated.
- Analytics query performance test with indexed date ranges.

## Definition of Done

- [x] All ACs green under pnpm test and bun test.
- [x] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.

## Open questions

- Decided: packages are still `@vp/*` (the rebrand is ticket 48), so the port is `ViewBufferPort` in `packages/server/core/ports/view-buffer.ts` (no `.port.ts` suffix, core invariant 5) and the adapter is `packages/server/adapters/redis/redis-view-buffer.adapter.ts`.
- Decided: the flush is effectively-once, not just at-least-once. `video_view_batches` records each applied batch id in the same transaction as the counters, and the batch key is deleted only after the commit. A flush that dies before the commit finds the same batch pending and applies it; one that dies after it sees the id and only releases it. Ledger rows older than a day are forgotten by the flush.
- Decided: the buffer hash field is `{videoId}|{YYYY-MM-DD}|views` (and `|watch` for watch seconds) rather than a bare `{videoId}`, so a batch that spans midnight lands each view on the day it was counted, and average retention has watch time to divide.
- Decided: `record` runs PFADD, the sliding EXPIRE and both HINCRBYs in one Lua script, so a beacon is one Redis round trip. The HyperLogLog undercounts distinct viewers by up to its ~0.81% standard error; that is the ticket's trade-off. The 10,000-beacon tests therefore assert that Postgres ends with exactly the count the buffer took.
- Decided: a signed-in viewer is deduplicated by account, an anonymous one by `sessionId`.
- Decided: the beacon endpoint does not look the video up (that would take a pool connection per beacon). An unknown or deleted video's counts are dropped at flush.
- Decided: the Redis fallback lives in the external adapter family as `FallbackViewBuffer` (`@vp/adapters/resilient`) with a `CircuitBreaker` from `@vp/concurrency`. It holds views in process up to `views.fallbackCapacity` distinct viewers (a bounded map, not a literal ring buffer, since counts aggregate) and hands them to Redis on the first call that reaches it. A process that stops while Redis is down loses what it held.
- Decided: `flush-video-views` rides the housekeeping queue on `every: 10000` (cron has minute resolution), so a long housekeeping task delays it; the buffer just grows meanwhile.
- Decided: tuning (`views.*` in `AppConfig`) comes from `tuning.ts` with no new environment key.

