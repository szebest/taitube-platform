# Load & Chaos Test Results (SDD §14)

This directory records empirical evidence and repeatable proof for all performance, load, and chaos scenarios specified in SDD §14.

---

## Results Summary Table

| Date | Scenario | Fault Injected | Expected Invariants | Result | Observations & Interpretation |
|---|---|---|---|---|---|
| **2026-09-03** | **S4 Worker Kill (Ticket 09)** | `kill -9` transcode worker mid-flight at ~50% progress | 1. Video reaches `READY`<br/>2. Stalled detected ≤ `lockDuration + stalledInterval` (≤ 150 s)<br/>3. `video.ready` event count = 1<br/>4. `renditions.status='DONE'` once<br/>5. Zero orphaned files | **5/5 PASS** | BullMQ stalled checker re-queued the job; second attempt completed transcode; zombie fencing tokens prevented duplicate commits; identical object keys overwritten cleanly. |
| **2026-09-03** | **Network Partition (Ticket 09)** | Container paused (`docker pause`) for > 120 s, then unpaused | 1. Fresh worker claims and finishes job<br/>2. Paused worker unpauses and attempts commit<br/>3. Paused worker gets `fenced: true` (`FENCED_OUT` logged, 0 rows affected) | **PASS** | PostgreSQL conditional CAS `UPDATE ... WHERE lock_token = $token` safely rejected the stale worker. |
| **2026-09-03** | **Redis Restart (Ticket 09)** | Redis restarted during active transcode | 1. Workers automatically reconnect via ioredis retry strategy<br/>2. In-flight jobs complete or re-queue<br/>3. No stuck videos | **PASS** | Redis AOF `everysec` ensured queue state integrity. Reconnection succeeded within 2 seconds. |
| **2026-09-05** | **[Phase 2 Acceptance E2E Suite (Ticket 20)](results/2026-09-05-e2e/)** | 20 mixed concurrent videos (1080p, 720p, 360p, VFR, portrait, 4K60, multi-tenant) + hostile set (corrupt, audio-only, 0-byte, text, bad codec) + forced transient DLQ replay + abandoned upload sweep | 1. 20 concurrent videos terminal in < 15 min<br/>2. Variant ladders without upscaling<br/>3. Master + poster + 12-frame sprite<br/>4. Hostile files in DLQ (attempt 1)<br/>5. Exactly 1 video.ready/failed event<br/>6. Forced transient DLQ replayed<br/>7. Stale upload ABANDONED | **20/20 PASS** (86.7s wall-clock) | Executable Phase 2 exit gate passed in 86.7s on local stack. Proved full Flows fan-out/fan-in, segment streaming, SSE progress+status, dual upload paths, CAS durability, and DLQ replay mechanics. |
| **2026-09-10** | **[Compose Autoscaler Burst Simulation (Ticket 27)](results/2026-09-10-compose-autoscaler/)** | 20 burst uploads driving queue backlog on compose | 1. Scales to max on backlog<br/>2. Holds during 300s cooldown<br/>3. Scales to min on cooldown expiry<br/>4. Never scales below active count | **PASS** | `pnpm compose-autoscaler` control loop verified. Evaluated dynamic `docker compose up -d --scale <service>=N --no-recreate` transitions with pure decision logic. |

---

## BullMQ Stalled Semantics & Implementation Findings (SDD §9.5 Note)

1. **Stalled Re-Queue vs Failure Retry**:
   - When a worker dies, BullMQ's stalled checker detects that the Redis lock was not renewed after `lockDuration` (120 s).
   - The job is moved back from `active` to `wait`.
   - In BullMQ, a stalled job recovery increments internal `stalledCounter` rather than `attemptsMade`. The job is re-run with the same `attemptsMade` unless it stalls more than `maxStalledCount` (configured to 2), at which point it transitions to `failed` / DLQ.
2. **Fencing Token Exclusivity**:
   - Because BullMQ provides at-least-once delivery, double execution is possible during network partitions.
   - Durability is guaranteed by `processing_steps.lock_token` (UUIDv7 generated on each claim). A zombie worker whose lock expired receives `fenced: true` on `completeStep()` and logs `event: 'FENCED_OUT'`, skipping event publication and follow-up job enqueueing.
