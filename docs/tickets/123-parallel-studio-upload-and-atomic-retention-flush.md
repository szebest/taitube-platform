# 123: Parallel Studio upload parts and an atomic view and retention flush

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | 43 - Views buffer and creator analytics · 65 - Playback telemetry · 109 - Upload lifecycle hardening |
| Blocks | — |
| Spec | [SDD §3.1 Upload](../SDD.md#31-upload-multipart-direct-to-storage) · [SDD §9.8 Housekeeping](../SDD.md#98-housekeeping-job-schedulers) |

**Status:** done

> **Why.** The first draft named four bottlenecks. Two are real, two are not, and one was real but not worth its cost.
>
> Real:
> 1. **Studio sends multipart parts one at a time.** `putParts` in `apps/client/studio/src/features/upload/api/upload-video.ts`
>    awaits each `axios.put` in a `for` loop. A 4 GiB file is 128 parts of 32 MiB (109), so the transfer runs on one TCP
>    stream and is capped by window over round trip, and one slow part stalls everything behind it.
>    [109](109-upload-lifecycle-hardening-and-leak-prevention.md) left parallel parts out of scope; `@vp/upload-client`
>    already runs four at a time.
> 2. **A retention flush that fails loses its steps.** `RedisViewBufferAdapter.drainRetention` is `HGETALL` then `DEL` in
>    one script, and `runFlushVideoRetention` applies the result afterwards, so a database error or a restart between the
>    two drops every buffered step. `flush-video-retention.ts` says so on purpose ("a step is a statistic"). Views have no
>    such hole: `snapshot` moves the buffer under a batch id, `applyBatch` records the id in `video_view_batches` in the
>    same transaction, and `release` runs only afterwards. The retention curve is read by the studio
>    ([65](65-first-party-video-playback-telemetry-analytics-beacon.md)) and by 114, so a blip should not cost a flush.
>    The first draft pointed at `stageViews` and `claimBatch`; neither is the pattern (`stageViews` does not exist,
>    `claimBatch` is the outbox).
>
> Not real, cut:
> - **Axios replaced by `fetch` "for progress".** `fetch` has no upload progress event, and streaming request bodies need
>   HTTP/2 and are Chromium only, so dropping axios would lose the progress bar. Axios stays.
> - **A range-request storm on the raw source.** Measured: a 600 s, 305 MB H.264 MP4 with `moov` at the tail, served by a
>   range-logging server, `ffmpeg -ss 450 -t 30 -i <url>` (the shape of `buildChunkArgs`). It made 4 requests, read
>   the 0.5 MB `moov`, seeked straight to byte 228 953 622 and transferred about 23 MB in all, the chunk's own 30 s. No
>   multi-gigabyte walk, so no source cache or keyframe splitting.
> - **`fs.readFile` of the chunk in `transcode-chunk.ts`.** It exists, but a chunk is 30 s of at most 1080p, tens of
>   megabytes, one per pod (`transcodeStage` concurrency is 1). Streaming it needs a `contentLength` on
>   `StorageUploadParams`, and checks of the S3 SDK's checksum trailers against R2 and of a stream body under Bun, for no
>   measurable gain. See Out of scope for when that changes.

## What to build

### 1. Parallel parts in Studio

Only `upload-video.ts` and its specs change; the signature of `uploadVideo`, `UploadSession` and the hook do not.

- `putParts` runs a fixed pool of `PART_CONCURRENCY = 4` workers (a constant beside `PART_URL_BATCH`, not a setting)
  that each take the next part number until none is left, as `@vp/upload-client` does. It stays in the studio: that
  package is server tier and the studio is client tier, and the loop is a dozen lines.
- Progress is bytes: each in-flight part reports `loaded` through axios's `onUploadProgress`, `onProgress` gets
  `sum(loaded) / file.size`, and the value reported never goes down (`Math.max` with the last one).
- `partUrl` memoises the in-flight `issueUploadParts` request per batch. Today two callers missing the same URL would
  issue the same batch twice; with four workers they meet at every 100th part.
- The first failed part aborts the rest through an internal `AbortController` combined with the caller's `signal`
  (`AbortSignal.any`), so a failure or a cancel stops every in-flight PUT and no new part starts. The existing abort
  path in `uploadVideo` (DELETE once, error swallowed) is unchanged, as is `pagehide` in the hook.
- Parts are returned sorted by `partNumber`; `completeUpload` needs them in order.

### 2. One atomic flush for views and retention

Retention joins the view batch instead of getting a second ledger.

- `ViewBatch` (`packages/universal/domain/src/views.ts`) gains `retention: readonly RetentionCount[]`.
- `RedisViewBufferAdapter.snapshot`: the Lua script renames the view buffer and the retention buffer together under the
  batch id and points `viewFlushPointer` at it, and answers `null` only when both are empty; `release` deletes both
  staged keys with the pointer. `CacheKeys` (`packages/server/events/src/keys.ts`) gains `retentionFlushBatch(batchId)`.
  `drainRetention` is deleted from `ViewBufferPort`, the Redis, in-memory and `FallbackViewBuffer` implementations and
  the fake Redis, so no caller can drain destructively.
- `PostgresVideoViewRepository.applyBatch` applies the batch's views and its retention in the one transaction that
  already claims the batch id, with one `known` lookup for both; `applyRetention` and `runFlushVideoRetention` (with its
  call in `housekeeping/index.ts`) go. Retention now flushes on the views interval.
- `InMemoryViewBuffer` and `InMemoryVideoViewRepository` follow the same shape, so the contract suites hold for both.

## Delivery

Two independent PRs, in any order: (1) Studio parallel parts, (2) the atomic flush.

## Acceptance criteria

- [ ] With four parts in flight, Studio never has more than four PUTs open, reports progress that never decreases and
      ends at 100, and completes with the parts sorted. (`upload-video.test.ts`)
- [ ] A failed part aborts the others, starts no new part and sends the DELETE once; a cancel after the first part does the
      same. (`upload-video.test.ts`, `use-upload-video.dom.test.ts`)
- [ ] A file with more parts than `PART_URL_BATCH` issues each batch of part URLs once under concurrency.
- [ ] `snapshot` on a buffer holding only retention steps returns a batch; a second `snapshot` before `release` returns
      the same batch; `release` empties it; steps recorded after a snapshot land in the next batch. Over the in-memory and
      Redis buffers. (`view-buffer.contract.ts`)
- [ ] `applyBatch` applies views and retention once for a repeated batch id, and a failure after the retention insert
      rolls both back. Over both repositories. (`video-view-repository.contract.ts`)
- [ ] `runFlushVideoViews` with `applyBatch` failing leaves the batch pending, and the next run applies it with no step
      lost or doubled. (`flush-video-views.test.ts`)
- [ ] `drainRetention`, `applyRetention` and `runFlushVideoRetention` appear nowhere (`grep` returns 0).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm test`, `pnpm test:bun` and `pnpm test:architecture` pass, with
      output in the PR.

## Out of scope

- Replacing axios, a configurable concurrency, per-part retries and a resume path in Studio.
- Streaming the chunk upload in `transcode-chunk.ts`. Revisit when a chunk can exceed about 100 MB or a pod runs several
  chunks at once (a 4K ladder, hardware encoding from [107](107-chunked-parallel-transcoding-and-hardware-acceleration.md)
  with higher concurrency); the work is then a `contentLength` on `StorageUploadParams` plus the R2 and Bun checks above.
- A source cache or keyframe-aligned splitting for chunk jobs.
- Housekeeping sweeps, view and watch history writes, segment upload and per-stage concurrency: each already does what
  the first draft asked (see the 127 decision under Open questions).

## Testing plan

- Studio: `upload-video.test.ts` with the axios `put` spy resolving out of order and a gate counting concurrent calls;
  the hook's DOM spec through the suite's render helper.
- Contract: the `view-buffer.contract.ts` and `video-view-repository.contract.ts` cases above, run over the in-memory
  and the Redis and Postgres adapters, as the existing suites are.
- Worker: `flush-video-views.test.ts` with a failing and a replaying `applyBatch`.
- Dual runtime: the adapter and worker specs under `vitest` and `bun test`.

## Open questions

- Decided: retention joins the view batch rather than gaining its own pointer, ledger and flush task. One snapshot,
  one transaction and one ledger row mean views and retention can never disagree after a crash, and `drainRetention`
  disappears instead of being guarded.
- Decided: the existing `video_view_batches` ledger is reused as is; retention needs no new table and no migration.
- Decided: 127 (data parallelism and bulk I/O) is deleted, not rewritten. Measured on main: `applyBatch` is already one
  multi-row `UPDATE ... FROM (VALUES ...)` plus one multi-row upsert; watch history is write-behind with a one minute
  throttle (`WatchHistoryService`); `recordAll` and the reaction store already pipeline or `MULTI`; `StreamingSegmentUploader`
  already uploads each segment concurrently while FFmpeg encodes; `STAGE_REGISTRY` already sets 1, 2, 4 and 8 per stage;
  `deleteObjects` already batches 1 000 keys. What was left, serial housekeeping over at most 100 videos per run, costs
  seconds and has no measured backlog.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
