# Phase 2 Acceptance — Pipeline E2E Suite Results (Ticket 20)

**Date:** 2026-09-05  
**Overall Status:** PASSED (20/20 Videos + DLQ Replay + Abandoned Cleanup)  
**Total Wall-Clock Time:** 113.6s (< 15 min requirement satisfied)  
**Concurrency:** 20 videos in flight simultaneously  

---

## 1. Summary of 20 Concurrent Pipeline Executions

| # | Name | Fixture | Mode | Dur | Variants | Segments | Status | Code | Playable | Total | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | s15-single | s15.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 40.12s | 40.17s | PASS |
| 2 | s15-multi | s15.mp4 | multipart | 15s | 1080p, 720p, 480p | 3 | READY | - | 14.12s | 14.20s | PASS |
| 3 | s60-single | s60.mp4 | single | 60s | 1080p, 720p, 480p | 10 | READY | - | 105.79s | 105.95s | PASS |
| 4 | s60-multi | s60.mp4 | multipart | 60s | 1080p, 720p, 480p | 10 | READY | - | 80.90s | 81.21s | PASS |
| 5 | p720-single | p720.mp4 | single | 15s | 720p, 480p | 3 | READY | - | 22.69s | 22.71s | PASS |
| 6 | p720-multi | p720.mp4 | multipart | 15s | 720p, 480p | 3 | READY | - | 26.56s | 26.75s | PASS |
| 7 | sd360-single | sd360.mp4 | single | 15s | 480p | 3 | READY | - | 5.08s | 5.45s | PASS |
| 8 | sd360-multi | sd360.mp4 | multipart | 15s | 480p | 3 | READY | - | 8.28s | 8.56s | PASS |
| 9 | portrait-single | portrait.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 48.29s | 48.46s | PASS |
| 10 | portrait-multi | portrait.mp4 | multipart | 15s | 1080p, 720p, 480p | 3 | READY | - | 22.10s | 22.28s | PASS |
| 11 | vfr-single | vfr.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 56.39s | 56.52s | PASS |
| 12 | vfr-multi | vfr.mp4 | multipart | 15s | 1080p, 720p, 480p | 3 | READY | - | 31.87s | 31.99s | PASS |
| 13 | k60-multi | k60.mp4 | multipart | 10s | 1080p, 720p, 480p | 2 | READY | - | 88.14s | 88.38s | PASS |
| 14 | s15-user2-single | s15.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 110.63s | 110.79s | PASS |
| 15 | p720-user2-multi | p720.mp4 | multipart | 15s | 720p, 480p | 3 | READY | - | 74.65s | 74.70s | PASS |
| 16 | hostile-truncated | truncated.mp4 | single | 5s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 1.05s | PASS |
| 17 | hostile-audio-only | audio-only.mp4 | single | 5s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 1.44s | PASS |
| 18 | hostile-zero-bytes | zero-bytes.mp4 | single | 0s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 1.46s | PASS |
| 19 | hostile-not-video | not-a-video.mp4 | single | 0s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 2.00s | PASS |
| 20 | hostile-bad-codec | bad-codec.mov | single | 1s | - | 0 | FAILED | UNSUPPORTED_CODEC | - | 2.00s | PASS |


---

## 2. Invariant & Acceptance Criteria Verification

| Requirement | Expected | Observed | Verdict |
|---|---|---|---|
| **Terminal Status (< 15 min)** | All 20 videos terminal in < 15 min | All 20 videos finished in 113.6s | **PASS** |
| **Video Variant Ladders** | 1080p: 3 (1080p,720p,480p)<br/>720p: 2 (720p,480p)<br/>360p: 1 (480p) | Exact matching variants without upscaling | **PASS** |
| **Segment Count** | `ceil(duration / 6)` | 15s → 3 segs, 60s → 10 segs, 10s → 2 segs | **PASS** |
| **Thumbnails** | Poster + 12-frame sprite present | `posterKey` & `spriteKey` populated on all READY videos | **PASS** |
| **Event Uniqueness** | Exactly one `video.ready` or `video.failed` | Exactly 1 terminal event per video in `video_events` | **PASS** |
| **SSE Delivery** | `snapshot → progress* → status` | Received in order on all 20 streams | **PASS** |
| **DLQ Hostile Set** | Hostile files land in DLQ with `attemptsMade = 1` | 6 entries in DLQ; all parked on attempt 1 with expected codes (`CORRUPT_CONTAINER`, `UNSUPPORTED_CODEC`) | **PASS** |
| **Forced-Transient DLQ Replay** | Replay via `POST /admin/dlq/:id/replay` succeeds | Entry 52f5fc43-1c15-42f5-8ab4-84d026dfd89e replayed as fd4f74b2-9eec-4e5f-95e8-bdf565f1acb3--transcode--720p--g1--r1 → final status REPLAYED | **PASS** |
| **Abandoned Upload Cleanup** | Stale `UPLOADING` multipart becomes `ABANDONED` | Video 01a071b3-29af-7016-a7e7-0428f3a95464 transitioned to `ABANDONED`, upload 01a071b3-29af-7016-a7e7-04295caca469 marked `ABORTED` | **PASS** |

---

## 3. Observations & Phase 2 Definition of Done (SDD §18)

- **Flow Fan-Out / Fan-In:** BullMQ flow producer cleanly executed parallel transcode renditions and thumbnail generation child jobs before completing the package parent.
- **Dual Upload Paths:** Both single presigned PUT and multipart uploads (with concurrency 4 and part slicing) succeeded without loss.
- **FailParentOnFailure Verification:** Hostile transcode/probe failures aborted the flow immediately and recorded exactly one `video.failed` event with the originating error code.
- **Local-First & Dual Runtime:** Zero external network calls; executed entirely locally.
