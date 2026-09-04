# 14: Stream segments to storage while encoding — 30-minute sources with bounded disk, aligned keyframes, thread back-off

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | M–L |
| Blocked by | 12 — Flows fan-out/fan-in |
| Blocks | 20 |
| Spec | [PRD §7 NFR (large file)](../PRD.md#7-non-functional-requirements-slos) · [PRD §11 Risk: disk exhaustion](../PRD.md#11-risks-mitigations) · [SDD §8.2 (independent_segments+temp_file, threads)](../SDD.md#82-transcode-one-rendition-to-hls-ts-segments) · [SDD §9.6 rule 6 (threads per attempt)](../SDD.md#96-failure-handling-retries-dlq-poison-pills) · [SDD §14.2 S2](../SDD.md#142-scenarios) |

**Status:** done

## What to build
The transcode worker no longer waits for FFmpeg to finish before uploading: it watches the output directory, uploads each `.ts` as soon as FFmpeg renames it into place (bounded concurrency 4), deletes it locally, and uploads the playlist **last**. A 30-minute source therefore never needs more local disk than *source + a couple of segments*. Retry attempts reduce `-threads` by one per attempt (min 1) to survive marginal memory. Keyframe alignment across renditions is verified so hls.js switches without glitches.

## Acceptance criteria
- [x] `l30` transcodes to all rungs with `worker_tmp_bytes` (or `du` sampled every 5 s) never exceeding `sourceSize + 3 × maxSegmentBytes`; local dir empty after completion and after a forced failure.
- [x] Playlist object is written only after every segment upload succeeded; a segment upload failure → transient retry of the *upload*, and after N failures the job fails transient (never a playlist pointing at missing segments).
- [x] Attempt 2 of a job logs `threads = FFMPEG_THREADS - 1`; attempt ≥ FFMPEG_THREADS uses 1.
- [x] Keyframe timestamps of segment N are identical (± 1 frame) across 1080p/720p/480p for `s60` and `vfr` (VFR handled with constant-frame-rate output).
- [x] Optional streaming input mode (`-i presigned-url`) works for `s60` and is documented as the low-disk fallback.
- [x] `ENOSPC` during encode is classified transient with the hint `DISK_FULL` and the temp dir is cleaned.

## Out of scope
Chunked parallel transcoding (backlog), CMAF (backlog).

## Notes for the implementer
- Rely on FFmpeg's `temp_file` flag: only files without the `.tmp` suffix are complete.
- Upload concurrency and `Cache-Control: immutable` per SDD §7.

## Testing plan
Integration with `l30` (CI uses `m10` for time); disk sampling in the test; fault injection by making the bucket read-only mid-run (MinIO policy flip).

## Open questions
- None.

## Definition of Done
- [x] AC green; SDD §8.2 note on disk requirement updated with measured numbers.

## Code Review
- **Status:** Approved
- **Review Report:** [Review Report](../reviews/14-segment-streaming-uploader-disk-bounds-review.md)
- **Key Findings:**
  - Full compliance with AC 1–6, SDD §8.2, §9.6 rule 6, and §14.2 S2.
  - `StreamingSegmentUploader` bounds worker disk to `sourceSize + 3 × maxSegmentBytes` by tailing directory, uploading closed segments, and unlinking immediately.
  - Playlist `index.m3u8` is uploaded strictly last, after all segments succeed.
  - Thread back-off calculation reduces `-threads` on retry attempts down to 1 (`baseThreads - (attempt - 1)`).
  - Constant frame rate output (`-fps_mode cfr`) enforces keyframe PTS alignment across 1080p/720p/480p within 1 frame (< 0.05s) for both `s60` and `vfr` sources.
  - Presigned GET streaming input mode works seamlessly without downloading the source locally.
  - `ENOSPC` error classified as `TransientError` with hint `DISK_FULL` and temp directory cleaned on all exit paths.

