# 127: Data parallelism & bulk I/O pipelines — multi-stream ingestion, parallel database batching & worker fan-out

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | XL (delivered as three slices, see *Delivery*) |
| Blocked by | 16 - Retries and DLQ · 40 - High-throughput video reactions · 46 - Watch history engine · 65 - Playback telemetry · 107 - Chunked parallel transcoding · 123 - Ingestion performance hardening |
| Blocks | — |
| Spec | [SDD §3.2 Processing pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §9.3 Flows](../SDD.md#93-fan-out--fan-in-with-flows) · [SDD §9.8 Housekeeping](../SDD.md#98-housekeeping-job-schedulers) · [SDD ADR-08 Transcode parallelism](../SDD.md#adr-08--transcode-parallelism-one-job-per-rendition-fan-out-chunked-transcoding-as-stretch) |

**Status:** blocked

> **Why.** (written by Gemini, let Claude verify)
> Modern high-throughput media and data architectures maximize hardware efficiency through controlled parallelism, vectorized batching, and pipelined I/O.
> While [12](12-ladder-flows-fanout-fanin.md) introduced BullMQ Flow fan-out for renditions and [107](107-chunked-parallel-transcoding-and-hardware-acceleration.md) split long videos into 30s chunks, several critical data paths in our platform remain constrained by sequential processing, single-row round-trips, and serialization bottlenecks:
> 1. **Sequential Database Sweeps & Deletes**: Housekeeping tasks (`expire-raw`, `reconcile-processing`, `purge-deleted`, `reconcile-uploads`) iterate through stale rows and execute storage/database mutations one-by-one or in unbuffered sequential loops, starving connection pools during traffic spikes.
> 2. **Single-Stream HLS Packaging & S3 Upload**: While transcoding is chunked, the final HLS packaging and segment upload step uploads individual `.ts` files to object storage serially, adding 15–30 seconds of pure HTTP handshake overhead on 100+ segment playlists.
> 3. **Unbatched Reaction & View Event Flush**: High-throughput telemetry and view buffers flush in small bursts without utilizing PostgreSQL `UNNEST` multi-row vector upserts or pipelined Redis transactions (`MULTI/EXEC`), creating avoidable lock contention on hot video rows.
> 4. **Worker Stage Concurrency Saturation**: Individual worker processes run with rigid concurrency settings rather than dynamically sizing concurrency based on job payload characteristics (e.g. lightweight probe/notify vs heavy transcode).
> This ticket introduces a comprehensive data parallelism and vectorized batching architecture across ingestion, storage I/O, database persistence, and worker execution.

## What to build (written by Gemini, let Claude verify)

### 1. Vectorized Database Batching & Bulk Upserts (`@vp/db` & `@vp/adapters`)
- In `packages/server/adapters/postgres/`:
  - **Bulk Multi-Row Upserts via `UNNEST`**:
    - Update `postgres-video-view-repository.ts` and `postgres-watch-history-repository.ts` to replace single-row `ON CONFLICT` loops with PostgreSQL vectorized array unnesting:
      ```sql
      INSERT INTO video_views (video_id, view_count, updated_at)
      SELECT * FROM UNNEST($1::uuid[], $2::int[], $3::timestamptz[])
      ON CONFLICT (video_id) DO UPDATE SET view_count = video_views.view_count + EXCLUDED.view_count;
      ```
    - Reduces 1,000 individual query round-trips to a single round-trip taking < 5ms.
  - **Pipelined Redis Buffer Drains**:
    - Replace sequential Redis `HINCRBY` / `HSET` calls in telemetry adapters with pipelined executions (`redis.pipeline()`), reducing network latency between app and Redis cluster.

### 2. Parallel Segment Storage Uploader (`@vp/storage` & `@vp/ffmpeg`)
- In `packages/server/storage/` and `apps/server/worker/src/stages/segment-uploader.ts`:
  - Introduce `ParallelSegmentUploader`: uploads generated HLS `.ts` segments to object storage concurrently using an asynchronous bounded worker pool (`concurrency: 6`).
  - Implements speculative parallel upload: as soon as FFmpeg emits a completed segment on disk via `-f hls -hls_flags temp_file`, an upload task is immediately dispatched in the background while FFmpeg continues encoding the next segment, eliminating post-encode upload latency entirely.

### 3. Batched Parallel Housekeeping & Reconciler Sweeps (`apps/server/worker`)
- In `apps/server/worker/src/stages/housekeeping/`:
  - Upgrade `reconcile-uploads.ts`, `expire-raw.ts`, and `purge-deleted.ts` to process batches of stale entities concurrently with bounded parallelism (`p-limit` pool of 8 concurrent S3 deletes / DB transitions).
  - Bulk S3 Deletes: Aggregate unlinked chunk keys and expired assets into batched S3 `DeleteObjectsCommand` calls (up to 1,000 keys per request), slashing storage API calls by 99%.

### 4. Adaptive Worker Stage Concurrency Tuning (`apps/server/worker`)
- In `apps/server/worker/src/registry.ts` and `stage-settings.ts`:
  - Configure differentiated stage concurrency in BullMQ worker registration:
    - Lightweight I/O stages (`probe`, `notify`, `reconcile-uploads`): high concurrency (10–20 concurrent jobs per worker pod).
    - Heavy CPU/Encoding stages (`transcode-1080p`, `transcode-chunk`): strictly core-bounded concurrency (1–2 per pod, aligned to CPU quotas).
    - Packaging & uploader stages: network-bounded concurrency (4–8 per pod).

## Acceptance criteria (written by Gemini, let Claude verify)

- [ ] Video view and watch progress batch flushes use PostgreSQL `UNNEST` vectorized multi-row upserts; verified by query log showing 1 query per batch flush. (written by Gemini, let Claude verify)
- [ ] Redis view buffer and retention metrics utilize pipelined command execution (`pipeline()`) with 0 sequential round-trip blocking. (written by Gemini, let Claude verify)
- [ ] `ParallelSegmentUploader` uploads HLS segments concurrently (concurrency 6) during active FFmpeg transcode; final packaging completes within 1 second after FFmpeg exits. (written by Gemini, let Claude verify)
- [ ] Housekeeping stages (`expire-raw`, `purge-deleted`, `reconcile-uploads`) execute bulk S3 `DeleteObjects` (up to 1,000 keys per call) and parallelize database state transitions. (written by Gemini, let Claude verify)
- [ ] Worker stage concurrency is specialized by stage type in `registry.ts` with zero regression under high-load k6 smoke tests. (written by Gemini, let Claude verify)
- [ ] Dual-runtime compatibility: executes identically and passes under both `vitest` and `bun test`. (written by Gemini, let Claude verify)
