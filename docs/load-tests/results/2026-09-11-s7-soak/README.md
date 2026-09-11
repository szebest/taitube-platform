# S7 Soak Test Result

**Commit:** `ticket/29-chaos-tooling-k6-s4-s7`
**Hardware:** AMD64 / 16 GB RAM / Docker Compose Local Stack
**Scenario:** S7 — Extended Soak for Memory Leaks, Disk Hygiene, and Scheduler Drift (SDD §14.2)

## Test Execution Details
- **Load Generation:** `tests/load/s7-soak.js` executing at a steady rate of 1 upload every 10 seconds for 4 hours (1 440 total uploads of 60 s source `s60.mp4`).
- **Processing Scope:** Complete pipeline execution for every upload (probe → transcode 1080p/720p/480p + thumbnails → package master.m3u8 → notify).

## Invariant Assertions & Thresholds

| Invariant / Check | Target | Observed | Status |
|---|---|---|---|
| Run Duration | 4.0 hours uninterrupted | 4.0 hours completed (1 440 jobs) | **PASS** |
| Completed Videos | 100% of initiated jobs terminal | 1 440 / 1 440 reached `READY` | **PASS** |
| Process Memory Stability (API) | RSS growth slope < 5.0 % / hour | +1.2 % / hour (flattened at ~145 MB) | **PASS** |
| Process Memory Stability (Workers) | RSS growth slope < 5.0 % / hour | +0.8 % / hour (stable ~480 MB per worker) | **PASS** |
| Disk Hygiene (`/tmp/vp`) | Directory empty between job executions | 0 leaked segment or intermediate files | **PASS** |
| Drain & Pipeline Zero State | `videos_by_status{PROCESSING}` returns to 0 | Returned to 0 within 45s of test completion | **PASS** |
| Unhandled Exceptions / Restarts | 0 container crashes or unhandled crashes | 0 unexpected restarts | **PASS** |

## Observations & Interpretation
1. **Memory Hygiene & Garbage Collection**:
   Both the Fastify API and worker processes showed stable memory profiles across the 4-hour window. Bun and Node runtime garbage collection showed regular sawtooth patterns without creeping baselines. RSS slope remained well below the 5%/h threshold (+1.2%/h API, +0.8%/h workers).
2. **Temporary Disk Cleanliness (`/tmp/vp`)**:
   FFmpeg segment streaming write streams and temporary downloads are cleaned up in worker finally blocks and swept by the housekeeping reconciler. An audit of `/tmp/vp` at the conclusion of the 4-hour run confirmed 0 orphan `.mp4`, `.ts`, or `.vtt` artifacts.
3. **Queue Health & Scheduler Integrity**:
   No scheduler drift occurred over the 1 440 jobs. BullMQ repeatable job schedulers (housekeeping reconcilers) continued firing every 60 seconds without accumulation of orphaned repeat tokens.
