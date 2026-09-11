# Runbook: Job Failure Rate High & Systemic Failure Circuit

## 1. Overview & Architecture
Workers process asynchronous video pipeline jobs (`probe`, `transcode-*`, `thumbnail`, `package`, `notify`, `housekeeping`). When jobs fail, BullMQ retries transient errors with exponential backoff and routes exhausted attempts or unrecoverable poison pills to DLQ.

Two failure rate alerts protect the system:
1. **`JobFailureRateHigh`**: Failure rate exceeds 5% over 10 minutes (`warning` / `critical`). Indicates elevated errors that need investigation.
2. **`SystemicFailure`**: Failure rate exceeds 50% over 5 minutes (`critical`). Indicates a systemic dependency outage (e.g. S3/MinIO down, Redis issues, database failures, bad code deployment).

---

## 2. Trigger Alerts
- **`JobFailureRateHigh`**:
  - Expression: `rate(jobs_processed_total{result="failed"}[10m]) / rate(jobs_processed_total[10m]) > 0.05`
  - Severity: `critical`
  - For: `10m`
- **`SystemicFailure`**:
  - Expression: `rate(jobs_processed_total{result="failed"}[5m]) / rate(jobs_processed_total[5m]) > 0.5`
  - Severity: `critical`
  - For: `5m`

---

## 3. Dashboards to Open
- **Pipeline Overview**: `/d/pipeline` — Check throughput and failure rates.
- **Workers Dashboard**: `/d/workers` — Check error breakdown, FFmpeg exit codes, and DLQ entries.
- **Queues Dashboard**: `/d/queues` — Check queue depths and active jobs.

---

## 4. Immediate Remediation (Systemic Failure Circuit Breaker)
Per SDD §9.6 rule 5:
> If `jobs_failed_total` for a queue exceeds 50% over 5 min, the alert `SystemicFailure` fires and the runbook says **pause the queue** rather than burning attempts against a dead dependency.

### Step 1: Pause the Affected Queue(s)
Pause processing immediately to avoid exhausting retries across all backlog jobs:
```bash
# Via Bull Board UI: Navigate to http://localhost:3000/admin/queues and click "Pause" on the affected queue

# Or via Admin API
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/<queue>/pause"
```

### Step 2: Identify the Root Cause
Check worker logs and recent DLQ entries to find the failing error code:
```bash
# Check recent DLQ entries
curl -s -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/dlq?limit=10" | jq .

# Check worker logs for specific stage
docker compose logs --tail=100 worker-<stage>
# or in Kubernetes:
kubectl logs -l stage=<stage> --tail=100
```
Common root causes:
- `STORAGE_UNAVAILABLE`: S3/MinIO/R2 endpoint unreachable or returning 503s.
- `DATABASE_ERROR`: Postgres connection pool exhausted or instance down.
- `FFMPEG_OOM` (exit 137): Container memory limits too low for the current resolution.
- Corrupt deployment: Recent worker container image introduced a regression.

### Step 3: Resolve the Dependency Issue
- If storage is degraded, restore MinIO/S3 or await Cloudflare R2 recovery.
- If memory limit is reached, bump memory limits in compose or Kubernetes deployment specs.

### Step 4: Resume the Queue
Once the underlying issue is resolved:
```bash
# Via Bull Board UI: click "Resume"
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues/<queue>/resume"
```

### Step 5: Replay DLQ Jobs
Follow `docs/runbooks/dlq-replay.md` to replay jobs parked during the outage:
```bash
curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/dlq/replay-all"
```

---

## 5. Verification
1. Confirm `rate(jobs_processed_total{result="failed"}[5m])` drops to near 0.
2. Verify jobs resume processing successfully and reach `result="completed"`.
3. Confirm alerts `SystemicFailure` and `JobFailureRateHigh` clear.
