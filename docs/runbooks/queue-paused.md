# Runbook: Queue Paused & Systemic Failure Mitigation

## 1. Overview & Architecture
In video-pipeline, BullMQ queues can be paused either manually by an operator or automatically as a circuit breaker during systemic failures (SDD §9.6, PRD §11, ADR-03).

When a downstream dependency suffers an outage (e.g. S3/MinIO unreachable, Postgres connection pool exhaustion, Redis memory limit reached), attempting to process jobs results in rapid attempt exhaustion and unintended job eviction to the Dead-Letter Queue (`dlq`).

Pausing the affected queue halts workers from picking up new waiting jobs (`paused` state in BullMQ) while allowing currently active jobs to finish or drain cleanly. Once the underlying incident is resolved, resuming the queue restarts ingestion and allows safe replay of any parked DLQ entries.

---

## 2. Trigger
- **Alert / Symptom**:
  - `SystemicFailure` alert firing (`rate(jobs_processed_total{result="failed"}[5m]) / rate(jobs_processed_total[5m]) > 0.5`).
  - `JobFailureRateHigh` alert firing continuously with common infrastructure error codes (`STORAGE_UNAVAILABLE`, `DATABASE_ERROR`).
  - Upstream dependency outage declared (e.g. Cloudflare R2 degraded, Neon maintenance window).
  - Operator manual pause for scheduled maintenance or schema migration.

---

## 3. Dashboards to Open
- **Queues Dashboard**: `/d/queues` — Inspect "Per-Queue Jobs by State" (check `paused`, `waiting`, `active`, `failed`), and "Queue Starvation & Latency".
- **Pipeline Overview**: `/d/pipeline` — Inspect "Pipeline Throughput & Job Completions" and error rates.
- **Workers Dashboard**: `/d/workers` — Check worker CPU, memory, and FFmpeg error exit codes.
- **Bull Board UI**: `http://localhost:3000/admin/queues` (or cluster ingress URL).

---

## 4. Diagnosis Steps

### Step 1: Check Which Queue Is Paused or Failing
Inspect queue status via Bull Board UI or query the API admin endpoint:
```bash
curl -s -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues" | jq .
```
Or check Prometheus metrics for failed job rates grouped by queue:
```promql
sum(rate(jobs_processed_total{result="failed"}[5m])) by (queue)
```

### Step 2: Identify Why the Queue Was Paused
1. Check recent error codes in DLQ or worker logs:
   ```bash
   curl -s -H "x-admin-token: $ADMIN_TOKEN" \
     "http://localhost:3000/admin/dlq?status=PARKED&limit=10" | jq .
   ```
2. Verify dependency health:
   - **PostgreSQL**: `pg_isready -h localhost -p 5432 -U vp`
   - **Redis**: `redis-cli ping` (expect `PONG`), `redis-cli info memory`
   - **Object Storage (S3 / R2 / MinIO)**: Check endpoint availability and presigned PUT/GET responses.

### Step 3: Check Active Jobs and Draining Status
Inspect whether active jobs are still running or if workers have drained:
```promql
bullmq_queue_jobs{state="active"}
```

---

## 5. Remediation Commands

### Step 1: Pause a Queue (If Not Already Paused)
To pause queue processing immediately and prevent burning retries:

**Via Bull Board UI**:
1. Open `http://localhost:3000/admin/queues`.
2. Find the target queue (e.g. `transcode-1080p`).
3. Click the **Pause** button in the queue header.

**Via Kubernetes**:
If Bull Board is unreachable, scale worker deployment to 0:
```bash
kubectl scale deployment worker-<stage> --replicas=0
```

**Via Docker Compose**:
```bash
locker compose stop worker-<stage>
```

### Step 2: Resolve the Root Cause
- If storage outage: follow `docs/runbooks/storage-outage.md`.
- If database pool exhausted: adjust `DATABASE_POOL_MAX` or scale pooler.
- If worker stuck: follow `docs/runbooks/worker-stuck.md`.

### Step 3: Resume the Queue
Once the dependency is verified healthy:

**Via Bull Board UI**:
1. Open `http://localhost:3000/admin/queues`.
2. Find the paused queue.
3. Click the **Resume** button.

**Via Kubernetes**:
Restore worker replicas or allow KEDAs to resume scaling:
```bash
kubectl scale deployment worker-<stage> --replicas=1
```

**Via Docker Compose**:
```bash
docker compose start worker-<stage>
```

### Step 4: Replay Any Parked DLQ Jobs
Follow `docs/runbooks/dlq-replay.md` to safely re-enqueue jobs that failed before the queue was paused:
```bash
curl -X POST \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resetAttempts": true}' \
  "http://localhost:3000/admin/dlq/<DLQ_ENTRY_ID>/replay"
```

---

## 6. Verification
1. Inspect Bull Board at `http://localhost:3000/admin/queues` ‐ confirm queue status shows **Active** (not Paused).
2. Check `bullmq_queue_jobs{queue="<queue>", state="waiting"}` — confirm waiting count begins decreasing.
3. Check `jobs_processed_total{queue="<queue>", result="completed"}` — confirm jobs complete successfully.
4. Verify `SystemicFailure` and `JobFailureRateHigh` alerts resolve in Prometheus / Alertmanager.

---

## 7. Prevention
1. **Circuit Breaker Automation**: The `SystemicFailure` alert notifies the on-call team within 5 minutes of high error rates so queues can be paused before attempt pools are exhausted.
2. **Deterministic Re-enqueues**: Reprocessing and DLQ replay generate deterministic suffixes (`--r1`, `--g2`), guaranteeing zero duplicate work or corrupted artifacts upon resumption.
3. **Graceful Draining**: Workers trap `SIGTERM` and finish inflight segments before shutting down, ensuring zero abandoned writes during planned pauses.
