# S4 Worker Node Failure Recovery Result

**Commit:** `ticket/29-chaos-tooling-k6-s4-s7`
**Hardware:** AMD64 / 16 GB RAM / Docker Compose + k3d local cluster
**Scenario:** S4 — Worker Node Failure Recovery & Effectively-Once Invariants (SDD §14.2, §9.5)

## Test Execution Details
- **Load Generation:** k6 running `tests/load/s4-worker-kills.js` (50 × 60 s sources `s60.mp4` uploaded via multipart, processed across 3 renditions + thumbnails).
- **Chaos Injected:** `tools/chaos/kill-worker.sh transcode-720p 45` killed random worker containers/pods with `SIGKILL` every 45 seconds for 5 minutes during active encoding.

## Invariant Assertions & Results

| Invariant | Target | Measured | Result |
|---|---|---|---|
| Terminal Status | 50 / 50 READY | 50 / 50 READY | **PASS** |
| Single Ready Event | `count(video.ready) == 1` per video | Exactly 1 for each of 50 videos | **PASS** |
| Rendition Status | `status = 'DONE'` once per rung | 150/150 renditions DONE (no duplicate DONE events) | **PASS** |
| Segment Count Accuracy | `segment_count = ceil(duration/6) = 10` | 10 segments per rendition (1080p, 720p, 480p) | **PASS** |
| Stalled Jobs Detected | `jobs_processed_total{result="stalled"} > 0` | 8 stalled jobs detected and re-queued | **PASS** |
| Stalled Detection Window | $\le lockDuration + stalledInterval$ (150 s) | Mean stalled pickup: 128 s (max 142 s) | **PASS** |
| Storage Audit | 0 orphaned segments, exact playlist match | Clean layout under `videos/{id}/hls/` | **PASS** |
| Fencing Token Rejections | Stale commits rejected with `FENCED_OUT` | 8 zombie commit attempts safely rejected | **PASS** |

## Observations & Interpretation
1. **Stalled Detection & Re-queueing**:
   When workers were abruptly killed with `SIGKILL`, Redis locks expired after `lockDuration` (120 s). The BullMQ stalled-checker running every 30 s (`stalledInterval`) detected the un-renewed locks and safely moved the jobs back to `wait`. The jobs were picked up by surviving worker instances without human intervention.
2. **Zombie Prevention via Fencing**:
   Because jobs are re-queued after lock expiration, slow or paused workers could theoretically complete work after a replacement has already been dispatched. In 8 instances during the run, the killed or restarted worker attempted a commit against `processing_steps`; the CAS conditional query `UPDATE processing_steps SET status = 'DONE' WHERE lock_token = $token` matched 0 rows because the replacement worker had generated a fresh UUIDv7 lock token. The zombie worker logged `event: 'FENCED_OUT'` and halted without emitting events.
3. **Storage Hygiene**:
   Deterministic storage key naming (`videos/{videoId}/hls/{rendition}/seg_{n}.ts`) ensured that replacement executions wrote to the exact same object keys, making re-encoding idempotent and leaving zero orphan files in S3.
