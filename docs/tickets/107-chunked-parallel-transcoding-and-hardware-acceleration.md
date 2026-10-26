# 107: Chunked parallel transcoding of long sources

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 14 - Segment streaming uploader · 28 - Load test S3 |
| Blocks | — |
| Spec | [SDD §8.5 Chunked parallel transcoding](../SDD.md#85-chunked-parallel-transcoding-phase-4-stretch--designed-not-built) · [SDD ADR-08 Transcode parallelism](../SDD.md#adr-08--transcode-parallelism-one-job-per-rendition-fan-out-chunked-transcoding-as-stretch) · [SDD §8.2 Transcode one rendition](../SDD.md#82-transcode-one-rendition-to-hls-ts-segments) |

**Status:** ready

> **Why.** `probe` fans a source out to one `transcode-<rendition>` job per rung, so a one hour 1080p source is one
> FFmpeg process on one pod for as long as the encode takes (SDD §9.1 puts `transcode-1080p` at up to 25 minutes
> before the 3600 s `MAX_DURATION_SEC` ceiling is reached). That job holds a pod, risks the OOM and timeout kills
> `classifyFfmpegError` already maps, and makes its retry restart from zero. Splitting long sources into fixed
> time chunks that encode in parallel on the same `transcode-<rendition>` queues bounds each job and each retry to
> a chunk, and lets KEDA turn queue depth into wall-clock speed. The job contract already carries `chunkIndex` and
> `chunkCount` (`TranscodeJob` in `@vp/job-contracts`), nothing produces or reads them yet.

## What to build

### 1. Chunk plan, decided at probe

- A source with `durationMs` above 300 s is chunked; anything shorter keeps today's flow byte for byte. Both numbers
  (`thresholdSeconds: 300`, `chunkSeconds: 30`) are constants in `packages/server/env-schema/src/tuning.ts` beside
  `FFMPEG_PROCESS`, not env keys. `chunkSeconds` is a multiple of `gopSeconds` (2 s) so every chunk starts on a
  forced keyframe boundary of the same grid in every rendition.
- `chunkCount = ceil(durationMs / (chunkSeconds * 1000))`, computed in `probe-enqueue.ts` from `metadata.durationMs`, so
  the BullMQ flow is static: `package` <- `concat` (one per rendition, on a new `concat` queue) <- `transcode-<rendition>` x
  `chunkCount`. No stage creates children while it runs, and no stream-copy `split` stage exists.
- Chunk job ids: `ids.transcodeChunk(videoId, rendition, chunkIndex, generation)` beside the existing `ids.transcode`;
  `ids.concat(videoId, rendition, generation)`. `concat` joins `QUEUES`, gets a `stagePolicies.concat` and a `ConcatJob`
  schema (`rendition`, `chunkCount`, `sourceKey`, `durationMs`) in `@vp/job-contracts`.

### 2. Chunk transcode (existing `transcode-<rendition>` queues)

- A `TranscodeJob` with `chunkIndex` set encodes `[chunkIndex * chunkSeconds, +chunkSeconds)` of the source: `-ss <start> -t <len>`
  before `-i` on the presigned source URL (`streamingInput` is forced on for chunk jobs, so a worker range-reads its
  slice and does not download the whole source), same scale, rate control, `-g`/`-force_key_frames` as
  `buildTranscodeArgs` today, `-an`, output one MP4 `chunk_<index>.mp4`. `buildTranscodeArgs` gains a chunk branch
  (a sibling `buildChunkArgs` in its own file if it passes the 250 line target); the HLS branch is untouched.
- The chunk is uploaded to `tmp/chunks/<videoId>/g<generation>/<rendition>/chunk_<index>.mp4` in the raw bucket (a
  `chunkKey` helper in `packages/server/storage/src/keys.ts`). Result: a `ChunkResult` (`type: 'chunk'`, `chunkIndex`,
  `bytes`) added to `ChildResult`. Step rows are claimed per chunk (`step: 'transcode-chunk'`, rendition
  `<name>:<index>`; the repository's `step` and `rendition` are free strings, confirm the unique key first), so the
  fencing token logic of `transcode.ts` applies per chunk unchanged.
- `transcode.ts` is already 315 lines: the chunk path is its own stage file (`transcode-chunk.ts`), sharing the
  claim/lease code through a helper rather than a second copy.

### 3. Concat and packaging (`concat` queue, new `concat.ts` stage)

- `concat-<rendition>` downloads its `chunkCount` chunks, writes the list file and runs the concat demuxer
  (`-f concat -safe 0 -i list.txt`) for video, takes audio once from the full source (`-map 1:a:0?`, AAC at the
  rung's `audioKbps`, 48 kHz stereo) so no seam falls inside the audio, and writes the rendition's HLS with
  `-c:v copy -f hls` using the same `hls_*` flags as the single-job path, through the existing segment uploader.
  It returns today's `TranscodeResult`, so `package` reads it as it reads a transcode child and the master playlist
  code does not change.
- Success deletes the rendition's `tmp/chunks/.../<rendition>/` objects. A failed or abandoned run leaves them: a
  `housekeeping` `tmp-sweep` branch (or the existing expiry task, whichever the code supports) removes `tmp/chunks/`
  objects older than a day. Say which in the PR.

### 4. Failure and observability

- A failed chunk fails its `concat` parent and `package` through `failParentOnFailure`, the same as a failed rendition
  today; each chunk keeps the stage retry policy and the thread-per-attempt reduction. Chunk and concat jobs emit the
  existing `ffmpegExitTotal` and duration metrics with `stage` set to `transcode-chunk` / `concat`, and KEDA gets a
  `ScaledObject` and compose-autoscaler entry for `concat` (`infra/k8s/base`, `infra/compose`).
- The SDD changes in the same PR (core rule 3): §8.5 now describes fixed time chunks re-encoded in place instead of a
  stream-copy split, and ADR-08 row 3 and §9.1's queue table gain `concat`.

## Acceptance criteria

- [ ] A 6 minute fixture produces 12 chunks per rendition, one `concat` per rendition and one `package`; a 4 minute
      fixture produces exactly today's flow (a test asserts the flow tree for both).
- [ ] The chunked output's master and every rendition playlist play to the end in `tools/hls-test-page`, and ffprobe
      on each rendition reports video and audio durations within one frame of the source and monotonically increasing
      PTS across every chunk boundary (an automated check, not an eyeball).
- [ ] Killing a chunk job's worker mid-encode retries that chunk only; the other chunks are not re-encoded.
- [ ] After `package` completes, no object remains under `tmp/chunks/<videoId>/`; after a failed run the sweep removes it.
- [ ] The existing single-job path is unchanged: its specs and `make smoke` pass without edits.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `make smoke-offline` green, with
      output in the PR.

## Out of scope

- Hardware encoders (NVENC, VAAPI, QSV, VideoToolbox) and `FFMPEG_HWACCEL`: not in this ticket, see Open questions.
- Dynamic cloud worker provisioning.
- AV1 / HEVC output (H.264 only, SDD §8.1).
- Chunking for `TRANSCODE_MODE=combined` nodes.

## Testing plan

- `probe-enqueue.test.ts`: an `it.each` over durations (299 s, 300 s, 301 s, `MAX_DURATION_SEC`) asserting the flow shape.
- `transcode-args` chunk branch: the `-ss`/`-t`/`-an` argv and the keyframe grid for chunk 0, a middle chunk and a short last one.
- `concat.test.ts`, `transcode-chunk.test.ts`: one spec file per new source file, against the in-memory storage and queue doubles.
- `keys` and `ids` specs for the new helpers; a `job-contracts` spec for `ConcatJob` and `ChunkResult`.
- One e2e under `make e2e` with a synthesized 6 minute video (`gen-video`) covering the ffprobe continuity check.

## Open questions

- Decided: hardware acceleration is not part of this ticket. The worker image is Debian `ffmpeg` on CPU pods; compose, k3d and
  the KEDA scale objects have no GPU, VideoToolbox does not exist on Linux, so CI could never exercise a hardware
  path and "mockable detection" would prove only the mocks. NVENC and VAAPI also need different filter graphs
  (`hwupload`, `scale_vaapi`), no `-preset`/`-sc_threshold`, and their own rate-control mapping. If wanted, it is a
  separate ticket after a real GPU target exists.
- Decided: `classifyFfmpegError` is not extended. It returns an error for the retry machinery and cannot fall back to
  another encoder; that needs a hardware path that does not exist yet.
- Decided: no `split` stage and no stream-copy chunks (SDD §8.5 step 2). A stream-copy split cuts only at source
  keyframes, so its chunk count is unknown until it runs and the flow could not be built at probe time (the
  `FlowProducerPort` has no way to add children to a running parent). Fixed time chunks cut with `-ss`/`-t` and
  re-encoded have a known count, no `raw-chunks/` copy of the source and no extra queue. SDD §8.5 and ADR-08 are updated to match.
- Decided: chunk jobs reuse the `transcode-<rendition>` queues, so per-rung KEDA sizing and the 1080p-heavier CPU
  weight stay as ADR-08 describes; only `concat` is a new queue (no `transcode-chunk-<rendition>` queues).
- Decided: audio is encoded once, inside `concat`, from the source, instead of a separate audio job: it is cheap next to the
  video, and it avoids per-chunk AAC priming gaps.
- Decided: threshold and chunk length are constants in `tuning.ts`, not env keys; add keys only when a load test needs to move them.
- Decided: the ticket keeps size L but ships as one stack of at most three slices: contracts, keys and the chunk argv; the
  chunk and concat stages; the probe flow, infra and the e2e.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §8.5, ADR-08 and §9.1 updated in the same PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
