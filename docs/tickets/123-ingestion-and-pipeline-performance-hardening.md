# 123: Ingestion & pipeline performance hardening — concurrent Studio multipart upload, worker stream I/O & crash-safe telemetry buffer

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 65 - Playback telemetry · 107 - Chunked transcode · 109 - Upload hardening |
| Blocks | 127 |
| Spec | [SDD §3.1 Upload](../SDD.md#31-upload-multipart-direct-to-storage) · [SDD §8.5 Chunked parallel transcoding](../SDD.md#85-chunked-parallel-transcoding-sources-over-5-minutes) · [SDD §9.8 Housekeeping](../SDD.md#98-housekeeping-job-schedulers) |

**Status:** ready

> **Why.** (written by Gemini, let Claude verify)
> While tickets 65, 107, and 109 successfully introduced chunked transcoding, upload abort lifecycles, and retention telemetry, several high-impact bottlenecks and reliability gaps remain:
> 1. **Studio sequential chunk upload bottleneck**: `apps/client/studio/src/features/upload/api/upload-video.ts` uploads multipart chunks in a blocking, single-threaded `for` loop awaiting one chunk at a time. On modern connections, serial uploading utilizes only a fraction of creator bandwidth due to sequential HTTP round-trip latencies. Furthermore, it pulls in `axios` solely for upload progress, which can be handled natively.
> 2. **Worker chunk RAM buffering**: In `apps/server/worker/src/stages/transcode-chunk.ts`, each 30-second transcoded MP4 chunk is read entirely into worker process memory using `fs.readFile(outputPath)` before uploading to S3, risking Node/Bun event-loop lag and OOM failures under heavy concurrent transcoding load.
> 3. **Raw source HTTP Range request storm on S3**: When processing a long-form video (e.g. 30 minutes / 60 chunks), 60 parallel worker instances simultaneously stream the raw master MP4 over HTTP using `-ss` seeking on presigned URLs. If the source file has its `moov` atom at the tail or unaligned keyframes, every worker repeatedly negotiates byte-range seeks across the entire multi-gigabyte source.
> 4. **Unguarded telemetry buffer drain in Redis**: `RedisViewBufferAdapter.drainRetention` executes a bare `HGETALL` immediately followed by `DEL` in Lua. If the worker process restarts, crashes, or encounters a transient database failure before persisting `video_retention_milestones`, all accumulated audience retention milestones are permanently lost without a recovery path.

## What to build (written by Gemini, let Claude verify)

### 1. Concurrent Studio Multipart Upload Pipeline
- In `apps/client/studio/src/features/upload/api/upload-video.ts`:
  - Replace the serial `for` loop with a concurrent worker pool (`concurrency: 4`, matching `@vp/upload-client`).
  - Calculate global upload progress continuously across active chunks using byte-level chunk tracking.
  - Replace `axios` with native `fetch` and `AbortSignal`, reducing client bundle overhead.
  - Preserve the cancel and `pagehide` abort lifecycle established in ticket 109.

### 2. Stream-Based Chunk I/O in Worker Stages
- In `apps/server/worker/src/stages/transcode-chunk.ts`:
  - Replace `fs.readFile` with stream-based storage upload (`fs.createReadStream(outputPath)` passed to `storage.uploadObject({ body })`), keeping worker memory footprint strictly bounded regardless of rendition bitrate or chunk resolution.
  - Optimize source retrieval: investigate keyframe-aligned source splitting or local cache leases to prevent redundant multi-worker HTTP byte-range negotiations against the same raw S3 object.

### 3. Crash-Safe Staged Retention Telemetry Buffer
- In `packages/server/adapters/redis/redis-view-buffer.adapter.ts`:
  - Replace the bare `HGETALL + DEL` in `drainRetention` with a 2-phase staged lease pattern matching `stageViews` and `claimBatch`.
  - Atomically rename the active retention buffer to a processing key (`retention:buffer:staged:<batchId>`).
  - Flush the batch into `video_retention_milestones` and only delete the staged key upon verified database commit.
  - Add an automatic lease expiry/recovery check so uncommitted batches are reclaimed rather than permanently dropped.

## Acceptance criteria (written by Gemini, let Claude verify)

- [ ] Creator Studio upload executes multipart chunk uploads with configurable concurrency (default 4) and reports smooth, monotonically increasing byte-level progress. (written by Gemini, let Claude verify)
- [ ] Dependency on `axios` is removed from `apps/client/studio`, with all uploads powered by native `fetch` and `@vp/api-client`. (written by Gemini, let Claude verify)
- [ ] `transcode-chunk.ts` streams chunk output files to storage without buffering full MP4 files in memory via `fs.readFile`. (written by Gemini, let Claude verify)
- [ ] `drainRetention` in `RedisViewBufferAdapter` uses a staged buffer key; killing the flush process mid-transaction leaves milestones intact for the next scheduled run. (written by Gemini, let Claude verify)
- [ ] Unit and contract tests for both in-memory and Redis view buffers prove crash recovery and zero milestone data loss. (written by Gemini, let Claude verify)
