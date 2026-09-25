---
name: vp-keda-queue-autoscaling
description: Autoscale BullMQ worker Deployments on queue depth with KEDA — the Prometheus scaler on waiting+prioritized+active (the only trigger), scale-to-zero, HPA behaviour to avoid flapping, safe scale-in with long grace periods and worker drain, plus the compose-level scaler for laptops. Use when writing ScaledObjects, sizing maxReplicaCount, or debugging "pods not scaling / scaled in mid-job".
license: MIT
metadata:
  project: video-pipeline
  spec: docs/SDD.md §13.2, ADR-12, §9.4, §12.2
---

# KEDA on BullMQ queue depth

## Model
- One Deployment per worker stage, `replicas` owned by KEDA (`minReplicaCount: 0`).
- Transcode workers run **one job per pod** (`concurrency: 1`, `FFMPEG_THREADS` = CPU limit), so `desiredReplicas = ceil(outstandingJobs / 1)`: threshold `1`.
- Outstanding = `waiting + prioritized + active`. Counting `active` stops KEDA from treating a busy pod as spare capacity; `prioritized` matters because prioritized jobs live in the `:prioritized` ZSET, **not** in the `wait` list.

## Primary trigger — Prometheus (metric from the API's queue poller)
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: vp-worker-transcode-1080p-scaledobject }
spec:
  scaleTargetRef: { name: vp-worker-transcode-1080p }
  minReplicaCount: 0
  maxReplicaCount: 6            # cloud overlay: 1 (1080p/720p), 2 (480p/probe)
  pollingInterval: 10
  cooldownPeriod: 300           # 5 min empty before scaling to zero
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:   { stabilizationWindowSeconds: 0,   policies: [{ type: Pods, value: 2, periodSeconds: 30 }] }
        scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: Pods, value: 1, periodSeconds: 60 }] }
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
        query: sum(max by (state) (bullmq_queue_jobs{queue="transcode-1080p", state=~"waiting|prioritized|active"})) or vector(0)
        threshold: "1"
        activationThreshold: "0"
```
`bullmq_queue_jobs{queue,state}` is produced by the API's queue poller (`getJobCounts()` over `QUEUE_JOB_STATES`). Every API replica exports the same depth, so take `max by (state)` before the `sum`; `infra/k8s/base/scaled-objects.yaml` is the source of truth. If the API is down, KEDA holds the last value — acceptable; alert `ScaleToZeroBroken` covers the pathological case.

## No Redis fallback
KEDA's `redis` scaler reads a list length. Every pipeline job carries a priority, so it sits in the `:prioritized` ZSET and the `wait` list stays empty: a list trigger never fires. `k8s-keda-autoscaling.test.ts` holds every ScaledObject to the one Prometheus trigger.

## Safe scale-in (the part people get wrong)
- Pod spec: `terminationGracePeriodSeconds: 900` for transcodes (60 for probe/package), liveness via the worker heartbeat file, `emptyDir` with `sizeLimit` for `/tmp/vp`.
- Worker: on `SIGTERM` call `worker.close()` → stops fetching, finishes the active job, exits 0. `tini` forwards signals.
- If Kubernetes kills the pod anyway (grace exceeded, node drain), the lock expires → job stalled → re-queued → idempotent redo (SDD §9.5). Never disable stalled detection to "avoid duplicates".
- Because the queue is *pulled*, over-provisioning during a burst is harmless — surplus pods idle and go away after `cooldownPeriod`.

## Sizing
- Local k3d: 6 transcode / 4 probe. Cloud 2-vCPU node: 1 for 1080p and 720p, 2 for 480p/probe — scale-to-zero is the cost lever, not scale-out (SDD §12.3).
- API is **not** KEDA-scaled: CPU HPA at 70 %.

## Proving it (ticket 26)
Burst 30 uploads → `kubectl get scaledobject -w`, `kubectl get hpa -w`; Grafana panel *replicas vs backlog* → export PNG to `docs/load-tests/results/`. Expect first new pod ≤ 60 s, replicas == min(backlog, max), 0 after cooldown.

## Debugging
- `kubectl describe scaledobject X` → conditions `Ready/Active`; `kubectl logs -n keda deploy/keda-operator | grep X`.
- Prometheus query returns empty → KEDA treats as 0 (check `ignoreNullValues`); verify the API `/metrics` has the series with the exact `queue` label.
- Pods scale but jobs stay `waiting` → Redis auth/`REDIS_URL` in the worker env, or `WORKER_STAGE` mismatch.
- Flapping → raise `scaleDown.stabilizationWindowSeconds`; never lower `cooldownPeriod` below the typical job length.

## Non-Kubernetes path
`pnpm compose-autoscaler` (`packages/server/compose-autoscaler`) polls `/metrics` and runs `docker compose up -d --scale worker-<stage>=N --no-recreate` with the same min/max/cooldown semantics (ticket 27). Compose stops the *newest* containers on scale-in — rely on idempotent redo.
