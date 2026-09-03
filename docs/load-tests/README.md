# Load & Chaos Test Results (SDD §14)

This directory records empirical evidence and repeatable proof for all performance, load, and chaos scenarios specified in SDD §14.

---

## Results Summary Table

| Date | Scenario | Fault Injected | Expected Invariants | Result | Observations & Interpretation |
|---|---|---|---|---|---|
| **2026-09-03** | **S4 Worker Kill (Ticket 09)** | `kill -9` transcode worker mid-flight at ~50% progress | 1. Video reaches `READY`<br/>2. Stalled detected ≤ `lockDuration + stalledInterval` (≤ 150 s)<br/>3. `video.ready` event count = 1<br/>4. `renditions.status='DONE'` once<br/>5. Zero orphaned files | **5/5 PASS** | BullMQ stalled checker re-queued the job; second attempt completed transcode; zombie fencing tokens prevented duplicate commits; identical object keys overwritten cleanly. |
| **2026-09-03** | **Network Partition (Ticket 09)** | Container paused (`docker pause`) for > 120 s, then unpaused | 1. Fresh worker claims and finishes job<br/>2. Paused worker unpauses and attempts commit<br/>3. Paused worker gets `fenced: true` (`FENCED_OUT` logged, 0 rows affected) | **PASS** | PostgreSQL conditional CAS `UPDATE ... WHERE lock_token = $token` safely rejected the stale worker. |
| **2026-09-03** | **Redis Restart (Ticket 09)** | Redis restarted during active transcode | 1. Workers automatically reconnect via ioredis retry strategy<br/>2. In-flight jobs complete or re-queue<br/>3. No stuck videos | **PASS** | Redis AOF `everysec` ensured queue state integrity. Reconnection succeeded within 2 seconds. |

---

## BullMQ Stalled Semantics & Implementation Findings (SDD §9.5 Note)

1. **Stalled Re-Queue vs Failure Retry**:
   - When a worker dies, BullMQ's stalled checker detects that the Redis lock was not renewed after `lockDuration` (120 s).
   - The job is moved back from `active` to `wait`.
   - In BullMQ, a stalled job recovery increments internal `stalledCounter` rather than `attemptsMade`. The job is re-run with the same `attemptsMade` unless it stalls more than `maxStalledCount` (configured to 2), at which point it transitions to `failed` / DLQ.
2. **Fencing Token Exclusivity**:
   - Because BullMQ provides at-least-once delivery, double execution is possible during network partitions.
   - Durability is guaranteed by `processing_steps.lock_token` (UUIDv7 generated on each claim). A zombie worker whose lock expired receives `fenced: true` on `completeStep()` and logs `event: 'FENCED_OUT'`, skipping event publication and follow-up job enqueueing.
