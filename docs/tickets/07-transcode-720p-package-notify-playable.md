# 07: `transcode-720p` + `package` + `notify` — a video becomes `READY` and plays in the test page

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Issue | [#7](https://github.com/szebest/taitube-platform/issues/7) |
| Size | L |
| Blocked by | 06 — Worker runtime + probe |
| Blocks | 08, 09, 12, 15 |
| Spec | [PRD US-5, US-7](../PRD.md#52-processing) · [PRD FR-4, FR-6, FR-7](../PRD.md#6-functional-requirements) · [SDD §3.2 Pipeline](../SDD.md#32-processing-pipeline-fan-out--fan-in) · [SDD §3.3 Playback](../SDD.md#33-playback) · [SDD §8.2 Transcode](../SDD.md#82-transcode-one-rendition-to-hls-ts-segments) · [SDD §8.4 Master playlist](../SDD.md#84-master-playlist-generated-by-package-not-by-ffmpeg) · [SDD §7 Storage layout](../SDD.md#7-object-storage-layout) · [SDD §10.2 Fan-out (publisher side)](../SDD.md#102-fan-out-architecture) · [ADR-07](../SDD.md#adr-07--delivery-format-hls-with-mpeg-ts-segments-mvp-cmaffmp4-upgrade-path) |

**Status:** done

## What to build
Upload `s60`, wait, open the test page, press Play — it plays. Probe now enqueues one `transcode-720p` job followed by `package`; the transcode worker downloads the source, runs FFmpeg with the exact SDD §8.2 arguments (6 s TS segments, 2 s aligned GOP, `independent_segments`), uploads the rendition directory and playlist to `public/videos/{id}/hls/720p/`, and returns the `TranscodeResult`; `package` writes a single-variant `master.m3u8` (correct `BANDWIDTH`/`RESOLUTION`/`CODECS`), CAS-flips `PROCESSING → READY`, and enqueues `notify`, which publishes the `video.ready` event on Redis Pub/Sub (`packages/events`). `GET /v1/videos/:id` now returns `playbackUrl`.

## Acceptance criteria
- [x] `s60` → `READY` in < 90 s on an 8 vCPU laptop; `master.m3u8` + `720p/index.m3u8` + 10 `.ts` segments exist with the SDD §7 content-types and cache headers; `renditions` row `DONE` with `segment_count=10`, `bytes`, `processing_ms`.
- [x] Every segment starts with an IDR (verify with ffprobe on two random segments); playlist contains `#EXT-X-INDEPENDENT-SEGMENTS`, `#EXT-X-PLAYLIST-TYPE:VOD`, `#EXT-X-ENDLIST`; `gop = round(2·fps)` derived from probe, not hard-coded.
- [x] `package` verifies the rendition playlist exists via HEAD before writing the master; master is written **last**; CAS to `READY` happens once; `video_events` contains exactly one `video.ready`.
- [x] `notify` publishes `{event:'status', data:{status:'READY', playbackUrl}}` on `video:{id}` and `user:{uid}` (subscribe in the test to assert).
- [x] The test page plays the video from `CDN_BASE_URL` (MinIO anonymous read) and hls.js reports a single level.
- [x] Progress callbacks from FFmpeg reach `job.updateProgress()` at most every 2 s and `processing_steps.heartbeat_at` advances.
- [x] FFmpeg exit 137 maps to `TransientError('FFMPEG_OOM')`, timeout to `FFMPEG_TIMEOUT`, `Invalid data found` to `PermanentError('CORRUPT_CONTAINER')` (unit tests with stubbed processes).

## Out of scope
Multi-rendition flows (12), segment streaming during encode (14 — here the directory is uploaded after FFmpeg finishes), SSE endpoint (15).

## Notes for the implementer
- Transcode concurrency 1 per process, `FFMPEG_THREADS` from env; `lockDuration 120 s`.
- Use `-progress pipe:1`, `-nostdin`, argv arrays only; capture the last 50 stderr lines for failure records.
- Hard per-job timeout `max(JOB_TIMEOUT_FACTOR × duration, 10 min)` kills FFmpeg and throws transient.

## Testing plan
Integration end-to-end on compose (upload → READY) with real FFmpeg in CI; unit snapshots for argv and master playlist; both runtimes.

## Open questions
- `veryfast` vs `fast` preset — keep env `X264_PRESET`, measure in 28.

## Definition of Done
- [x] Recorded GIF/screenshot of playback in the PR; AC green; README "First video end-to-end".
