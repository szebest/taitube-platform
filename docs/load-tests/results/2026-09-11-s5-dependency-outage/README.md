# S5 Dependency Outage Result

**Commit:** `ticket/29-chaos-tooling-k6-s4-s7`
**Hardware:** AMD64 / 16 GB RAM / Docker Compose with Toxiproxy
**Scenario:** S5 — Storage Outage, Redis Restart & DLQ Systemic Failure Circuit (SDD §14.2, §9.5, §9.6)

## Test Execution Details
- **Load Generation:** `tests/load/s5-dependency-outage.js` running 30 videos (`s15.mp4`) in flight.
- **Chaos Injected:**
  1. **Short S3 Outage (60 s)**: Injected via Toxiproxy (`./tools/chaos/toxiproxy-toxic.sh disable`, then `reset` after 60 s).
  2. **Redis Restart**: Injected via `./tools/chaos/redis-restart.sh` mid-flight.
  3. **Extended S3 Outage (15 min)**: Kept disabled until job retries exhausted (4 attempts) to verify DLQ and the `SystemicFailure` alert, followed by operator replay (`POST /admin/dlq/:id/replay`).

## Results Summary

| Sub-Scenario | Injected Fault | Expected Behavior | Observed Outcome | Result |
|---|---|---|---|---|
| **Short Storage 503** | Toxiproxy disables MinIO upstream for 60 s | TransientError thrown; workers retry with exponential backoff (10s, 20s, 40s ± jitter); all videos complete | All 30 videos reached `READY`; retry count matched failed attempts; 0 dropped jobs | **PASS** |
| **Redis Restart** | Container restarted via `redis-restart.sh` during transcode | ioredis reconnects; in-flight jobs finish; unacknowledged jobs picked up; 0 lost videos | Reconnection established in 1.4s; AOF preserved queue state; 30/30 videos reached `READY` | **PASS** |
| **Extended Outage** | 15-minute MinIO downtime | Attempts exhausted (4); jobs moved to DLQ; `SystemicFailure` alert triggers; admin queue pause; recovery + replay | `dlq_entries` populated; `SystemicFailure` alert fired in Prometheus; `POST /admin/dlq/:id/replay` re-enqueued jobs with `--r1` suffix; all videos transitioned to `READY` | **PASS** |

## Observations & Interpretation
1. **Exponential Backoff with Jitter (ADR-18)**:
   The configured jitter factor (`jitter: 0.5`) spread the retry waves smoothly when MinIO recovered after 60 seconds. Rather than a stampede of 30 workers hitting S3 simultaneously, retries arrived across a 15–35 second window, preventing storage connection saturation.
2. **Systemic Failure Runbook Execution**:
   When the outage exceeded 10 minutes, workers exhausted their maximum attempt counters (4 attempts per job). BullMQ's `failed` event listener moved jobs to the DLQ table in PostgreSQL and mirrored them to the `dlq` Redis queue. Prometheus evaluated `job_failure_rate > 0.5` over 5 minutes and fired `SystemicFailure`. Following runbook `docs/runbooks/systemic-failure.md`, queues were paused via the admin API, MinIO was restored, and jobs were replayed using the admin replay API. Every replayed job successfully reached `READY`.
3. **Redis Durability**:
   Redis restarted with AOF (`appendonly yes`, `appendfsync everysec`) and `noeviction`. No queue state was corrupted; ioredis reconnect handlers recovered the Redis connections transparently within seconds.
