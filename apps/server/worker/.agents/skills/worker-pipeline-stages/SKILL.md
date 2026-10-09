---
name: worker-pipeline-stages
description: BullMQ worker pipeline stages, FFmpeg transcoding, CAS fencing tokens, and temp dir lifecycle.
---

# Worker: Pipeline Stages & Durability

Guide for implementing and operating worker stages in `apps/worker`.

---

## 1. Stage Registry & Queue Topology

- Driven by `WORKER_STAGE` environment variable:
  - `probe`: FFmpeg ffprobe metadata inspection, aspect ratio, duration, dynamic rendition ladder computation.
  - `transcode-1080p`, `transcode-720p`, `transcode-480p`: Keyframe-aligned H.264/AAC transcoding into 6s MPEG-TS segments.
  - `thumbnail`: Poster frame and WebVTT sprite sheet generation.
  - `package`: Master HLS playlist generation linking all processed renditions.
  - `notify`: State finalization and real-time SSE completion broadcast.
- One BullMQ queue per stage for independent concurrency scaling and backoff.

---

## 2. Fencing Token Lifecycle

1. Worker claims step via `claimStep`: receives unique UUIDv7 `lock_token`.
2. Heartbeat periodically during execution via `heartbeatStep(lockToken)`.
3. Worker completes step via `completeStep` using the claimed `lockToken`.
4. If a zombie worker was delayed or restarted, PostgreSQL returns `fenced: true`, and the zombie safely discards work without corrupting state.

---

## 3. Ephemeral Storage Safety

- All intermediate transcode operations occur in `os.tmpdir()` subdirectories.
- A `finally` block or cleanup hook must guarantee directory removal on success, error, or unhandled rejection to prevent disk exhaustion.
