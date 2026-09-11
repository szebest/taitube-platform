# Runbook: Worker Stalled Jobs

## 1. Overview & Architecture
BullMQ workers maintain a lock on active jobs and periodically renew it (`lockRenewTime`). If a worker container crashes, gets killed (`kill -9`, OOM), or experiences severe network stalls, the lock expires (`lockDuration`, typically 120s). BullMQ's stalled checker detects this and moves the job back to `wait` while incrementing `stalledCounter`.

When `jobs_processed_total{result="stalled"}` increases by more than 3 over a 30-minute period, the `WorkerStalledJobs` alert fires.

---

## 2. Trigger Alert
- **Alert Name**: `WorkerStalledJobs`
- **Expression**: `increase(jobs_processed_total{result="stalled"}[30m]) > 3`
- **Severity**: `warning`
- **Duration**: `0m`

---

## 3. Dashboards to Open
- **Workers Dashboard**: `/d/workers` — Check worker CPU, memory, OOM exits (`ffmpeg_exit_total{code="137"}`), and stalled metrics.
- **Queues Dashboard**: `/d/queues` — Check active vs waiting jobs.

---

## 4. Diagnosis & Remediation Steps

### Step 1: Check for Worker Restarts and OOM Kills
Check if worker containers are restarting unexpectedly:
```bash
# Docker Compose
docker compose ps worker-<stage>

# Kubernetes
kubectl get pods -l app.kubernetes.io/component=worker
kubectl describe pod <pod-name> | grep -i "Last State" -A 5
```
If terminated with `Exit Code: 137` or `OOMKilled: true`:
- The container ran out of memory during FFmpeg encoding.
- Mitigate by increasing memory limits in `docker-compose.yml` or the Kubernetes deployment manifests.

### Step 2: Check Event Loop & Redis Connection Stalls
Inspect worker logs for lock renewal warnings:
```bash
docker compose logs --tail=100 worker-<stage> | grep -i "stalled"
```
If Node/Bun event loop is blocked or Redis latency is high (> 100ms), lock renewal requests may time out:
- Check Redis latency: `redis-cli --latency`
- Check worker thread concurrency: Ensure `concurrency: 1` on CPU-heavy transcode workers.

### Step 3: Verify Safe Redo Semantics
Under SDD §9.5, stalled jobs are re-queued automatically and safely re-executed due to deterministic object keys and database compare-and-set (CAS) fencing tokens. Verify that stalled jobs resume cleanly and reach `READY`.

---

## 5. Verification
1. Confirm `jobs_processed_total{result="stalled"}` stops increasing.
2. Confirm worker pods remain running without restarts.
3. Alert `WorkerStalledJobs` resolves.
