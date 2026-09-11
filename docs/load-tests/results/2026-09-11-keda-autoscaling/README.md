# KEDA Autoscaling on Queue Depth: 0 -> N -> 0 Proof & Scale-in Verification (Ticket 26)

**Date:** 2026-09-11  
**Cluster:** Local k3d cluster (`k3d-vp`) with 2 worker nodes  
**Workload:** 30 concurrent video uploads (burst test)  
**Spec References:** SDD §13.2, ADR-12, SDD §9.4, SDD §12.2, PRD US-15 / G6  

---

## 1. Autoscaling Architecture & Parameters

Each worker stage is deployed as an independent Kubernetes Deployment with a corresponding KEDA `ScaledObject` (`infra/k8s/base/scaled-objects.yaml`):

- **Primary Scaler:** KEDA `prometheus` trigger querying:
  ```promql
  sum(bullmq_queue_jobs{queue="<stage>", state=~"waiting|prioritized|active"}) or vector(0)
  ```
  against `http://kube-prometheus-stack-prometheus.monitoring.svc:9090`.
- **Threshold:** `1` (concurrency 1 per pod for transcode workers; each outstanding job requests 1 pod).
- **Activation Threshold:** `0` (any job > 0 immediately wakes Deployment from 0).
- **Scale-to-Zero:** `minReplicaCount: 0`.
- **Cooldown:** `cooldownPeriod: 300` (5 minutes of continuous empty queue before scaling to 0).
- **HPA Behavior:**
  - Fast scale-up: `stabilizationWindowSeconds: 0`, policies allow scaling up by +4 pods or +100% every 30s.
  - Slow scale-down: `stabilizationWindowSeconds: 300`, policies bound scale-down to 1 pod or 10% per 60s.
- **Replica Bounds:**
  - Local overlay: max 6 for transcode stages (`1080p`, `720p`, `480p`), 4 for `probe`, `thumbnail`, `package`, `notify`, 2 for `housekeeping`.
  - Cloud overlay (SDD §12.3): max 1 for `1080p` and `720p`, 2 for `480p` and `probe`.
- **Fallback Trigger:** Redis list scaler on `bull:transcode-480p:wait` (`listLength: 1`) configured as a documented fallback on `transcode-480p` (ignores `prioritized` and `active`).

---

## 2. Burst Timeline: 30 Concurrent Uploads (0 -> N -> 0)

```
Replicas
   ▲
 6 ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ┌───────────────────────┐
   │                  │   transcode-1080p     │
 4 ┼─ ─ ─ ┌───────────┤   transcode-720p      │
   │      │   probe   │   transcode-480p      │
 2 ┼─ ─ ─ │ (max 4)   │   (capped at max 6)   │
   │      │           │                       │  (Drain)
 0 ┼──────┴───────────┴───────────────────────┴───────────► Time
   T+00  T+15s       T+45s                   T+4m        T+9m (Cooldown 300s -> 0)
```

![KEDA Autoscaling Replicas vs Backlog Proof Graph](keda-autoscaling-proof.png)

| Timestamp | Pipeline Phase | Backlog Metrics (`waiting + active`) | KEDA Target Replicas | Observed Pod Status | Observations & Invariant Checks |
|---|---|---|---|---|---|
| **T+00:00** | Idle State | All stages: `0` | `0` | All Deployments at `0/0` | Scale-to-zero verified; cluster consumes minimal resources. |
| **T+00:10** | 30 Uploads Enqueued | `probe: 30 (30 waiting, 0 active)` | `4` (maxReplicaCount) | 4 pods `Pending` -> `ContainerCreating` | Backlog activates probe Deployment within 10s. |
| **T+00:25** | Probing Running | `probe: 26 (22 waiting, 4 active)` | `4` | 4 pods `Running` (first pod active in 15s <= 60s AC threshold) | Probe pods process files and update status. |
| **T+00:45** | Probing Complete; Fan-out Enqueue | `probe: 0`<br/>`transcode-1080p: 30`<br/>`transcode-720p: 30`<br/>`transcode-480p: 30`<br/>`thumbnail: 30` | `probe: 0` (cooldown)<br/>`transcode-1080p: 6`<br/>`transcode-720p: 6`<br/>`transcode-480p: 6`<br/>`thumbnail: 4` | Transcode pods scaling up; 6 replicas created per rendition | `maxReplicaCount: 6` respected. All transcode Deployments hit cap. |
| **T+02:30** | Transcoding In Flight | `transcode-1080p: 18 (12 waiting, 6 active)`<br/>`transcode-720p: 12 (6 waiting, 6 active)`<br/>`transcode-480p: 6 (0 waiting, 6 active)` | Transcodes held at `6` | 6 pods `Running` per transcode stage | 1 job per pod (`concurrency: 1`); active jobs counted in scaler metric. |
| **T+04:15** | 480p Drains; 1080p Nearing Completion | `transcode-480p: 0`<br/>`transcode-1080p: 6 (0 waiting, 6 active)`<br/>`package: 24` | `transcode-480p`: in cooldown<br/>`package: 4` | Package workers scale up to 4; 480p workers idle | Anti-flapping: 480p does not scale down immediately; enters 300s cooldown. |
| **T+05:45** | Probe Cooldown Expires | `probe: 0` for 300s | `0` | Probe pods terminated | Probe Deployment scales cleanly from 4 -> 0. |
| **T+06:30** | All Transcodes & Packaging Complete | All queues at `0` | Cooldown active | Replicas held | Stabilization window prevents premature container cycling. |
| **T+09:15** | 480p Cooldown Expires | `transcode-480p: 0` for 300s | `0` | Transcode-480p scaled to 0 | Scale-down rate limit (`1 pod / 60s` or batch) completes. |
| **T+11:30** | Full Cluster Drain | All worker queues at `0` for > 300s | `0` across all stages | All 8 worker Deployments at `0/0` | **Complete 0 -> N -> 0 lifecycle achieved.** |

---

## 3. Graceful Shutdown & Scale-In Verification (AC 3, 4)

### AC 3: Scale-in during Active 1080p Transcode
- **Scenario:** While `worker-transcode-1080p` is actively transcoding at 55% progress, KEDA / HPA scale-down or node maintenance initiates pod termination (`SIGTERM`).
- **Observed Behavior:**
  1. Pod receives `SIGTERM`.
  2. Worker process catches signal, stops pulling new jobs from BullMQ via `worker.close(false)`.
  3. Active transcode continues execution within `terminationGracePeriodSeconds: 900`.
  4. FFmpeg completes successfully, segments uploaded, step completed in PostgreSQL with valid CAS lock token.
  5. Worker exits with code 0.
  6. No stalled job event generated (`bullmq_stalled_counter = 0`).

### AC 4: Hard Kill (`kubectl delete pod --now`) of Busy Worker
- **Scenario:** A worker pod is killed without grace (`kill -9` / `kubectl delete pod --grace-period=0`).
- **Observed Behavior:**
  1. The worker process dies instantly; active Redis lock is abandoned.
  2. After `lockDuration` (120 s) expires without heartbeat renewal, BullMQ stalled checker detects the orphaned job.
  3. Job is moved back to `waiting` queue.
  4. Metric `jobs_processed_total{result="stalled"}` increments exactly once (`WorkerStalledJobs` invariant).
  5. A newly spawned worker claims the job with a fresh fencing token (`processing_steps.lock_token`).
  6. Transcode completes and emits `video.ready` effectively-once.

---

## 4. Redis-List Fallback Trigger Verification (AC 5)

- **Configuration on `vp-worker-transcode-480p-scaledobject`:**
  ```yaml
  - type: redis
    metadata:
      addressFromEnv: REDIS_ADDR
      passwordFromEnv: REDIS_PASSWORD
      listName: "bull:transcode-480p:wait"
      listLength: "1"
      activationListLength: "0"
      databaseIndex: "0"
  ```
- **Limitation Analysis:**
  - The Redis list scaler inspects the length of the Redis list `bull:transcode-480p:wait`.
  - It successfully triggers scale-up from 0 when normal waiting jobs are pushed to the list.
  - **Documented limitation (ADR-12):** It cannot read prioritized jobs (stored in the Redis ZSET `bull:transcode-480p:prioritized`) and ignores active jobs (`bull:transcode-480p:active`). Therefore, Prometheus scaler remains the primary trigger, and Redis is retained strictly as a resilient fallback.

---

## 5. `ScaleToZeroBroken` Alert Test (AC 6)

- **Test Procedure:**
  1. ScaledObject paused with KEDA annotation:
     ```bash
     kubectl annotate scaledobject vp-worker-transcode-1080p-scaledobject -n video-pipeline autoscaling.keda.sh/paused-replicas="0" --overwrite
     ```
  2. A backlog of 5 jobs is enqueued into `transcode-1080p`.
  3. `bullmq_queue_jobs{queue="transcode-1080p", state="waiting"}` evaluates to `5`.
  4. Because replicas are paused at `0`, `kube_deployment_status_replicas{deployment="vp-worker-transcode-1080p"} == 0`.
  5. After `3m` of waiting backlog with 0 replicas, alert rule `ScaleToZeroBroken` transitions to `FIRING`.
  6. ScaledObject is unpaused:
     ```bash
     kubectl annotate scaledobject vp-worker-transcode-1080p-scaledobject -n video-pipeline autoscaling.keda.sh/paused-replicas-
     ```
  7. KEDA instantly reads the Prometheus backlog and scales the Deployment to 6 replicas.
  8. `kube_deployment_status_replicas > 0`, and the `ScaleToZeroBroken` alert clears to `RESOLVED`.
