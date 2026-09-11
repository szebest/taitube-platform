# Runbook: API Latency High

## 1. Overview & Architecture
The `video-pipeline` API (`apps/api`) is a stateless Fastify control-plane service handling presigned upload negotiation, video metadata CRUD, SSE subscriptions, and admin queue inspection.

The system SLO targets p95 API response duration < 200 ms (`http_request_duration_seconds`). If the 95th percentile latency exceeds 200 ms for > 10 minutes, the `APILatencyHigh` alert fires.

---

## 2. Trigger Alert
- **Alert Name**: `APILatencyHigh`
- **Expression**: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.2`
- **Severity**: `warning`
- **Duration**: `10m`

---

## 3. Dashboards to Open
- **API Dashboard**: `/d/api` — Check "Request Latency (p50, p95, p99)", "Request Rate (R in RED)", and "In-Flight HTTP Requests" panels.

---

## 4. Diagnosis & Remediation Steps

### Step 1: Identify Slow Routes
Break down p95 latency by route and method:
```promql
topk(5, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route, method)))
```

### Step 2: Check Dependency Health
Slow API routes are typically caused by downstream dependencies:
1. **PostgreSQL Latency**:
   - Check query duration and active database connections:
     ```sql
     SELECT pid, now() - query_start AS duration, query, state
     FROM pg_stat_activity
     WHERE state != 'idle' ORDER BY duration DESC LIMIT 5;
     ```
   - Check if database CPU or I/O is saturated.
2. **Redis Latency**:
   - For Bull Board / admin routes, check if Redis is responding promptly:
     ```bash
     redis-cli --latency
     ```
3. **Object Storage (S3 / MinIO / R2)**:
   - Presign operations generate local URLs and should take < 5ms. However, `/complete` issues a `HeadObject` call to verify uploads. If storage is latent, `/complete` will be slow. Check `storage_op_duration_seconds{op="head"}`.

### Step 3: Check API Server Saturation
Inspect container CPU and memory usage:
```bash
docker stats vp-api
# or in Kubernetes:
kubectl top pods -l app.kubernetes.io/component=api
```
If API CPU > 80%, scale out API replicas:
```bash
# In Kubernetes:
kubectl scale deployment api --replicas=4
```

---

## 5. Verification
1. Inspect the API dashboard to verify p95 latency drops below 200 ms (0.2s).
2. Confirm no 5xx errors are occurring in the Error Rate panel.
3. Alert `APILatencyHigh` resolves.
