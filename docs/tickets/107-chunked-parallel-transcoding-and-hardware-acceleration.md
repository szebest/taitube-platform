# 107: Chunked parallel transcoding of long sources

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 14 - Segment streaming uploader · 28 - Load test S3 |
| Blocks | 111 |
| Spec | [SDD §8.5 Chunked parallel transcoding](../SDD.md#85-chunked-parallel-transcoding-sources-over-5-minutes) · [SDD ADR-08 Transcode parallelism](../SDD.md#adr-08--transcode-parallelism-one-job-per-rendition-fan-out-chunked-transcoding-as-stretch) · [SDD §8.2 Transcode one rendition](../SDD.md#82-transcode-one-rendition-to-hls-ts-segments) |

**Status:** done

> **Why.** `probe` fans a source out to one `transcode-<rendition>` job per rung, so a one hour 1080p source is one
> FFmpeg process on one pod for as long as the encode takes (SDD §9.1 puts `transcode-1080p` at up to 25 minutes
> before the 3600 s `MAX_DURATION_SEC` ceiling is reached). That job holds a pod, risks the OOM and timeout kills
> `classifyFfmpegError` already maps, and makes its retry restart from zero. Splitting long sources into fixed
> time chunks that encode in parallel on the same `transcode-<rendition>` queues bounds each job and each retry to
> a chunk, and lets KEDA turn queue depth into wall-clock speed. The job contract already carried `chunkIndex` and
> `chunkCount` (`TranscodeJob` in `@vp/job-contracts`), nothing produced or read them.

## What to build

- **Chunk plan** (`@vp/job-contracts`, `chunks.ts`): `CHUNKED_TRANSCODE = { thresholdSeconds: 300, chunkSeconds: 30 }` and
  `chunkCountFor(durationMs)`, `undefined` up to 300 s. 30 s is a multiple of the 2 s GOP, so every chunk starts on a
  keyframe of the same grid in every rendition. `ids.transcodeChunk` joins `ids`.
- **Flow** (`probe-enqueue.ts`): above the threshold each rendition's flow node is a concat job, a `TranscodeJob` with
  `chunkCount` and no `chunkIndex` under the single job's id, whose children are the `chunkCount` chunk jobs on the same
  `transcode-<rendition>` queue. The count is known at probe time, so one `FlowProducer.add` builds the tree. A source
  at or under 300 s gets today's flow unchanged.
- **Chunk stage** (`transcode-chunk.ts`): `-ss`/`-t` before `-i` on the presigned source URL, the rendition's video settings
  through the shared `videoEncodeArgs`, `-an`, one MP4 uploaded to `chunkKey(...)` (`tmp/chunks/<videoId>/g<n>/<rendition>/`,
  raw bucket). Step `transcode-chunk`, rendition `<name>--c<n>`, with the same lease and fencing as `transcode.ts`.
- **Concat stage** (the existing `transcode.ts`, selected by `chunkCount`): downloads the chunks, writes the list file,
  runs `buildConcatArgs` (`-f concat`, video `-c copy`, audio encoded once from the source) into HLS through the existing
  segment uploader, returns the usual `TranscodeResult`, and purges the rendition's chunk prefix on success. `package` is
  unchanged.
- **Plumbing**: `buildChunkArgs`, `buildConcatArgs`, `runFfmpegChunk`, `runFfmpegConcat` in `@vp/ffmpeg`, on `MediaTools` as
  `transcodeChunk` and `concat`; the registry routes a transcode-queue job with `chunkIndex` to the chunk stage; the in-memory
  `FlowProducer` now nests, as BullMQ's does.
- **Docs**: SDD §8.5 and ADR-08 row 3 describe the built design.

## Acceptance criteria

- [x] A source over 300 s fans out into `ceil(duration / 30)` chunk jobs under one concat job per rendition, a source at or
      under 300 s gets exactly today's flow. Evidence: `probe-enqueue.test.ts` (twelve chunks and a `waiting-children` concat
      for 360 s; the 60 s cases unchanged), `chunks.test.ts` (299, 300, 301, 360 and 3600 s).
- [x] Real FFmpeg joins re-encoded chunks and the source audio into a rendition as long as the source, with ascending PTS in both
      streams and audio and video starting and ending together. Evidence: `packages/server/ffmpeg/src/__tests__/chunk.test.ts`
      (ffprobe packet timeline over the HLS playlist).
- [x] A chunked source runs end to end through the registry's processors to a READY video, the rendition DONE, every chunk
      encoded once, and no object left under `tmp/chunks/<videoId>/`. Evidence: `chunked-flow.test.ts`.
- [x] A finished chunk step is not encoded again, a failed encode fails only its chunk step, a missing chunk fails the
      rendition before FFmpeg starts. Evidence: `transcode-chunk.test.ts`, `transcode.test.ts` (concat cases).
- [x] The single-job path is unchanged. Evidence: the existing `transcode`, `probe-enqueue`, `fanout-fanin-flow` and
      `package` specs pass without edits.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, output in the PR.

## Out of scope

- Hardware encoders (NVENC, VAAPI, QSV, VideoToolbox) and `FFMPEG_HWACCEL`: see Open questions.
- Dynamic cloud worker provisioning.
- AV1 / HEVC output (H.264 only, SDD §8.1).
- Chunking for `TRANSCODE_MODE=combined` nodes.
- Playback of a chunked rendition in `tools/hls-test-page` and a six minute run through `make e2e`: the 300 s threshold needs a
  fixture over five minutes (`m10` is `slow` and outside the e2e set), so the proof is the real FFmpeg join and the in-memory flow.

## Testing plan

- `chunks.test.ts`: the chunk plan around the threshold. `keys.test.ts`, `index.test.ts`: the new key and id.
- `chunk-args.test.ts`, `chunk.test.ts`: the argv, and a real FFmpeg chunk-and-join checked with ffprobe.
- `transcode-chunk.test.ts`, `transcode.test.ts`: the two stages over the in-memory doubles.
- `probe-enqueue.test.ts`, `chunked-flow.test.ts`: the flow tree, and the whole flow to READY.
- `flow-producer.contract.ts`: a nested flow runs bottom up, against the in-memory producer and BullMQ's.

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
- Decided: no new queue at all. Chunk jobs and the concat job both run on the `transcode-<rendition>` queues, told apart by
  `chunkIndex` and `chunkCount` in the payload, so queue names, `stagePolicies`, KEDA, compose and k8s are untouched and
  ADR-08's per-rung sizing holds. A concat job only becomes runnable after its chunks are done, so it cannot starve them.
- Decided: the concat job keeps the single job's id and step row, so `package`, the failure handler, the reconciler and the
  rendition row read it as they read any rendition's transcode.
- Decided: audio is encoded once, inside the concat job, from the source (streamed), instead of a separate audio job: it is
  cheap next to the video, and it avoids per-chunk AAC priming gaps.
- Decided: threshold and chunk length are constants in `@vp/job-contracts` (`chunks.ts`), not env keys and not in `tuning.ts`:
  the producer and the worker both read them there, and a key is added when a load test needs to move them.
- Decided: chunk objects live under `tmp/chunks/` in the raw bucket and are purged by the concat job on success. A failed run
  leaves them for the bucket's lifecycle, no sweep task.
- Decided: it ships as one PR, built in three commits: contracts, keys and arguments; the stages; the flow, in-memory producer
  and docs.

## Definition of Done

- [x] All acceptance criteria proved with command output in the PR.
- [x] SDD §8.5 and ADR-08 updated in the same PR.
- [x] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
