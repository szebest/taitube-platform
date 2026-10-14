---
name: keda-queue-autoscaling
description: >-
  Autoscaling queue workers on queue depth with KEDA: what to count, thresholds per pod,
  scale to zero, HPA behaviour against flapping, safe scale-in for long jobs, debugging.
  Use when writing a ScaledObject, sizing replicas, or debugging pods that do not scale or
  get scaled in mid-job.
license: MIT
---

# KEDA on queue depth

Scaling pull-based workers (BullMQ or any queue) with KEDA. This repo's ScaledObjects,
metric, sizes and the Compose fallback: `references/this-repo.md`.

## What to count

- **Outstanding work = waiting + prioritized + active.** Counting `active` stops KEDA
  treating a busy pod as spare capacity. In BullMQ, prioritized jobs live in a sorted set,
  not the wait list, so a scaler that reads a list length never sees them.
- **The threshold is jobs per pod**: a CPU-bound worker running one job at a time scales at
  `threshold: "1"`, so desired replicas equal outstanding jobs.
- **One source for the metric**: export queue depth from one poller as a gauge
  (`queue_jobs{queue, state}`). When several replicas export the same depth, dedupe before
  summing: `sum(max by (state) (queue_jobs{queue="<q>", state=~"waiting|prioritized|active"})) or vector(0)`.
  The `or vector(0)` keeps an empty result from reading as an error.

## Scale to zero

- `minReplicaCount: 0` enables it; at one or more the scaler is always active.
- Activation (0 to 1) and scaling (1 to N) are separate thresholds; activation fires only
  when the value is strictly greater than `activationThreshold`.
- `cooldownPeriod` (the wait before going back to zero) is never shorter than a typical
  job.

## Against flapping

Scale up fast, down slowly, through the HPA behaviour KEDA passes on:

```yaml
advanced:
  horizontalPodAutoscalerConfig:
    behavior:
      scaleUp:   { stabilizationWindowSeconds: 0,   policies: [{ type: Pods, value: 2, periodSeconds: 30 }] }
      scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: Pods, value: 1, periodSeconds: 60 }] }
```

Flapping is fixed by a longer scale-down stabilization window, never by a shorter cooldown.

## Safe scale-in, the part that goes wrong

- `terminationGracePeriodSeconds` covers the longest job of the stage; short stages get a
  short one.
- The worker handles `SIGTERM`: stop fetching, finish the active job, exit 0
  (`bullmq-pipeline`, Workers). An init process forwards the signal.
- A pod killed anyway (grace exceeded, node drain) loses its lock, the job stalls and is
  re-queued, and the redo is idempotent. Never disable stalled detection to "avoid
  duplicates".
- For work much longer than any sane grace period, run it as a Kubernetes Job (KEDA
  `ScaledJob`) instead of a Deployment.
- A pulled queue makes over-provisioning harmless: surplus pods find nothing and go away
  after the cooldown.

## Debugging

- `kubectl describe scaledobject <name>`: the `Ready` and `Active` conditions; then
  `kubectl logs -n keda deploy/keda-operator | grep <name>`.
- An empty query result: check the exporter's `/metrics` for the series with the exact
  queue label, and `ignoreNullValues` on the trigger.
- Pods scale but jobs stay waiting: the worker's queue connection or its stage selection is
  wrong, not KEDA.
- Proving it: a burst of uploads with `kubectl get scaledobject -w` and `kubectl get hpa -w`
  open, and a replicas-versus-backlog graph; expect replicas to reach
  `min(backlog, max)` and return to zero after the cooldown.
