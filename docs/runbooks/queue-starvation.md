# Runbook: Queue Starvation

## 1. Overview & Architecture
`video-pipeline` relies on BullMQ worker pools running per stage (`probe`, `transcode-*`, `thumbnail`, `package`, `notify`, `housekeeping`). Each queue tracks job wait times and oldest waiting job ages.

When `bullmq_queue_oldest_waiting_age_seconds` exceeds 900 seconds (15 minutes) for any queue, the `QueueStarvation` alert fires. This indicates jobs are sitting in the queue without being picked up by active workers.

---

## 2. Trigger Alert
- **Alert Name**: `QueueStarvation`
- **Expression**: `bullmq_queue_oldest_waiting_age_seconds > 900`
- **Severity**: `warning`
- **Duration**: `5m`

---

## 3. Dashboards to Open
- **Queues Dashboard**: `/d/queues` — Check "Per-Queue Jobs by State", "Replicas vs Outstanding Backlog", and "Queue Starvation & Latency" panels.
- **Workers Dashboard**: `/d/workers` — Check worker CPU, memory, and active worker count.

---

## 4. Diagnosis & Remediation Steps

### Step 1: Identify the Starving Queue
Inspect the alert labels or query Prometheus:
```promql
topk(5, bullmq_queue_oldest_waiting_age_seconds)
```

### Step 2: Check Worker Replicas & Status
Check whether worker pods/containers for that stage are running:
```bash
# Docker Compose mode
docker compose ps | grep worker

# Kubernetes mode
kubectl get pods -l app.kubernetes.io/component=worker
```

### Step 3: Check KEDA Autoscaler / ScaledObject
If in Kubernetes, check why KEDA hasn't scaled up worker replicas:
```bash
kubectl describe scaledobject worker-<stage>
kubectl get hpa
```
If in Docker Compose mode, verify the compose autoscaler:
```bash
docker compose logs compose-autoscaler
```

### Step 4: Scale Workers Manually if Needed
If autoscaler is hung or failing, manually scale the affected worker stage:
```bash
# Docker Compose mode
docker compose up -d --scale worker-<stage>=4 --no-recreate

# Kubernetes mode
kubectl scale deployment worker-<stage> --replicas=4
```

### Step 5: Check for Redis Lock or Connection Stalls
Inspect Redis queue state and worker connectivity via Bull Board at `/admin/queues` or CLI:
```bash
curl -s -H "x-admin-token: $ADMIN_TOKEN" "http://localhost:3000/admin/queues" | jq .
```
Verify Redis memory and connection pool health:
```bash
redis-cli info memory
redis-cli info clients
```

---

## 5. Verification
1. Monitor `bullmq_queue_oldest_waiting_age_seconds{queue="<queue>"}` until it drops below 60 seconds.
2. Confirm active jobs are processing and completing in `jobs_processed_total{queue="<queue>", result="completed"}`.
3. Verify the `QueueStarvation` alert resolves in Prometheus / Alertmanager.
