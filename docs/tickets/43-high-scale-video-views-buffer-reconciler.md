# 43: High-scale video views buffer (Redis batch flush) & creator studio analytics

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 38 — User & channel identity |
| Blocks | 44, 45, 65 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §9.4 Worker process model](../SDD.md#94-worker-process-model) · [SDD §9.8 Housekeeping schedulers](../SDD.md#98-housekeeping-job-schedulers) |

**Status:** blocked

## What to build

Directly incrementing a video's view counter in PostgreSQL (UPDATE videos SET views = views + 1 WHERE id = ) on every playback event saturates database locks and crashes the DB under heavy traffic.

This ticket delivers:
1. **Redis-Buffered View Counter**:
   - POST /v1/videos/:id/views registers a playback view.
   - Deduplication: Uses a sliding window or HyperLogLog (vp:views:dedup:{videoId}:{date}) to deduplicate repeated views from the same IP/user within a cooldown period (e.g. 30 seconds).
   - Atomic buffering: Increments in Redis key vp:views:buffer:{videoId}.
2. **Batched View Flush Reconciler (BullMQ Worker)**:
   - Schedulable worker job running periodically (e.g., every 10–30 seconds) that collects dirty keys, sums increments, and flushes batch updates to PostgreSQL in a single multi-row UPDATE query.
3. **Persistent View Analytics**:
   - video_views_daily table for historical views per day per video.
   - Aggregate views_count on videos updated in batch.
4. **Creator Studio Analytics API**:
   - GET /v1/creator/videos/:id/analytics: Views over time (daily buckets for last 7, 30, 90 days), total views.
   - GET /v1/creator/channel/analytics: Total channel views, subscriber growth over time.

## Acceptance criteria

- [ ] Migration creating video_views_daily:
  - video_id UUID not null references videos.id on delete cascade, view_date date not null, views integer not null default 0.
  - Primary key (video_id, view_date).
- [ ] Add views_count bigint not null default 0 to videos table with index.
- [ ] ViewBufferPort in @vp/core/ports/view-buffer.port.ts and Redis adapter in adapters/redis/redis-view-buffer.adapter.ts.
- [ ] POST /v1/videos/:id/views endpoint:
  - Takes client telemetry (session id, watch duration).
  - Enforces deduplication window per viewer.
  - Buffers increment in Redis, returning 202 Accepted immediately (< 10ms latency).
- [ ] BullMQ scheduled job flush-video-views:
  - Runs periodically via worker reconciler scheduler.
  - Reads buffered views, flushes to videos.views_count and video_views_daily in a single transaction.
  - Clears flushed Redis buffers safely without losing newly arriving increments.
- [ ] Creator analytics endpoints:
  - GET /v1/creator/videos/:id/analytics: Requires creator ownership. Returns views timeline.
  - GET /v1/creator/channel/analytics: Aggregated channel views metrics.
- [ ] Load / concurrency test: Simulating 5,000 rapid view requests produces 0 database lock timeouts and results in exact consolidated view counts in Postgres after worker flush.

## Out of scope

- Complex geographic IP geolocation analytics (rely on simple client payload for now).

## Notes for the implementer

- **Atomic Redis buffer drain pattern:**
  Rename the dirty buffer key to a processing key before reading:
  ```ts
  const processingKey = `vp:views:processing:${Date.now()}`;
  await redis.rename(BUFFER_KEY, processingKey);
  const data = await redis.hgetall(processingKey);
  // Batch update Postgres
  await redis.del(processingKey);
  ```
- File length limit: <= 250 lines per file.

## Testing plan

- Unit tests for deduplication filter logic.
- Worker flush integration test: Seed Redis buffer, trigger reconciler job, assert PostgreSQL table values updated.
- Analytics query performance test with indexed date ranges.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
