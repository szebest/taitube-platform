# Phase 2 Acceptance — Pipeline E2E Suite Results (Ticket 20)

**Date:** 2026-09-05  
**Overall Status:** PASSED (20/20 Videos + DLQ Replay + Abandoned Cleanup)  
**Total Wall-Clock Time:** 98.7s (< 15 min requirement satisfied)  
**Concurrency:** 20 videos in flight simultaneously  

---

## 1. Summary of 20 Concurrent Pipeline Executions

| # | Name | Fixture | Mode | Dur | Variants | Segments | Status | Code | Playable | Total | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | s15-single | s15.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 30.06s | 30.26s | PASS |
| 2 | s15-multi | s15.mp4 | multipart | 15s | 1080p, 720p, 480p | 3 | READY | - | 12.34s | 12.48s | PASS |
| 3 | s60-single | s60.mp4 | single | 60s | 1080p, 720p, 480p | 10 | READY | - | 90.18s | 90.38s | PASS |
| 4 | s60-multi | s60.mp4 | multipart | 60s | 1080p, 720p, 480p | 10 | READY | - | 64.06s | 64.67s | PASS |
| 5 | p720-single | p720.mp4 | single | 15s | 720p, 480p | 3 | READY | - | 21.33s | 21.36s | PASS |
| 6 | p720-multi | p720.mp4 | multipart | 15s | 720p, 480p | 3 | READY | - | 12.68s | 12.85s | PASS |
| 7 | sd360-single | sd360.mp4 | single | 15s | 480p | 3 | READY | - | 5.49s | 5.84s | PASS |
| 8 | sd360-multi | sd360.mp4 | multipart | 15s | 480p | 3 | READY | - | 8.13s | 8.89s | PASS |
| 9 | portrait-single | portrait.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 36.61s | 36.79s | PASS |
| 10 | portrait-multi | portrait.mp4 | multipart | 15s | 1080p, 720p, 480p | 3 | READY | - | 17.65s | 17.69s | PASS |
| 11 | vfr-single | vfr.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 43.54s | 43.68s | PASS |
| 12 | vfr-multi | vfr.mp4 | multipart | 15s | 1080p, 720p, 480p | 3 | READY | - | 24.05s | 24.25s | PASS |
| 13 | k60-multi | k60.mp4 | multipart | 10s | 1080p, 720p, 480p | 2 | READY | - | 71.28s | 71.53s | PASS |
| 14 | s15-user2-single | s15.mp4 | single | 15s | 1080p, 720p, 480p | 3 | READY | - | 95.73s | 95.82s | PASS |
| 15 | p720-user2-multi | p720.mp4 | multipart | 15s | 720p, 480p | 3 | READY | - | 59.90s | 59.92s | PASS |
| 16 | hostile-truncated | truncated.mp4 | single | 5s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 1.62s | PASS |
| 17 | hostile-audio-only | audio-only.mp4 | single | 5s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 1.98s | PASS |
| 18 | hostile-zero-bytes | zero-bytes.mp4 | single | 0s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 2.26s | PASS |
| 19 | hostile-not-video | not-a-video.mp4 | single | 0s | - | 0 | FAILED | CORRUPT_CONTAINER | - | 2.26s | PASS |
| 20 | hostile-bad-codec | bad-codec.mov | single | 1s | - | 0 | FAILED | UNSUPPORTED_CODEC | - | 2.83s | PASS |


---

## 2. Invariant & Acceptance Criteria Verification

| Requirement | Expected | Observed | Verdict |
|---|---|---|---|
| **Terminal Status (< 15 min)** | All 20 videos terminal in < 15 min | All 20 videos finished in 98.7s | **PASS** |
| **Video Variant Ladders** | 1080p: 3 (1080p,720p,480p)<br/>720p: 2 (720p,480p)<br/>360p: 1 (480p) | Exact matching variants without upscaling | **PASS** |
| **Segment Count** | `ceil(duration / 6)` | 15s → 3 segs, 60s → 10 segs, 10s → 2 segs | **PASS** |
| **Thumbnails** | Poster + 12-frame sprite present | `posterKey` & `spriteKey` populated on all READY videos | **PASS** |
| **Event Uniqueness** | Exactly one `video.ready` or `video.failed` | Exactly 1 terminal event per video in `video_events` | **PASS** |
| **SSE Delivery** | `snapshot → progress* → status` | Received in order on all 20 streams | **PASS** |
| **DLQ Hostile Set** | Hostile files land in DLQ with `attemptsMade = 1` | 6 entries in DLQ; all parked on attempt 1 with expected codes (`CORRUPT_CONTAINER`, `UNSUPPORTED_CODEC`) | **PASS** |
| **Forced-Transient DLQ Replay** | Replay via `POST /admin/dlq/:id/replay` succeeds | Entry 896fe24d-d870-452f-aaec-f47c3c2f4bb0 replayed as 36d89a23-5e9a-4d1b-b480-b1442c6ead56--transcode--720p--g1--r1 → final status REPLAYED | **PASS** |
| **Abandoned Upload Cleanup** | Stale `UPLOADING` multipart becomes `ABANDONED` | Video 01a071bd-6143-7b39-adf7-89496e9e4cef transitioned to `ABANDONED`, upload 01a071bd-6143-7b39-adf7-894a699ee394 marked `ABORTED` | **PASS** |

---

## 3. Observations & Phase 2 Definition of Done (SDD §18)

- **Flow Fan-Out / Fan-In:** BullMQ flow producer cleanly executed parallel transcode renditions and thumbnail generation child jobs before completing the package parent.
- **Dual Upload Paths:** Both single presigned PUT and multipart uploads (with concurrency 4 and part slicing) succeeded without loss.
- **FailParentOnFailure Verification:** Hostile transcode/probe failures aborted the flow immediately and recorded exactly one `video.failed` event with the originating error code.
- **Local-First & Dual Runtime:** Zero external network calls; executed entirely locally.
