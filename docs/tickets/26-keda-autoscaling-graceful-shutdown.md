# 26: KEDA autoscaling on queue depth with safe scale-in — the 0 → N → 0 proof graph

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Issue | [#26](https://github.com/szebest/taitube-platform/issues/26) |
| Size | M–L |
| Blocked by | 25 — Kubernetes locally · 22 — Metrics catalogue |
| Blocks | 28 |
| Spec | [PRD US-15, G6](../PRD.md#54-operations) · [SDD §13.2 KEDA ScaledObject (YAML)](../SDD.md#132-keda-scaledobject-prometheus-scaler-primary) · [ADR-12](../SDD.md#adr-12--autoscaling-keda-scaledobject-per-stage-prometheus-scaler-primary-redis-list-scaler-fallback) · [SDD §9.4 (concurrency 1 per pod)](../SDD.md#94-worker-process-model) · [SDD §12.2 (grace period, probes)](../SDD.md#122-rung-2--kubernetes-locally-kind-or-k3d-phase-3) |

**Status:** done

## What to build
Every worker Deployment gets a KEDA `ScaledObject` (Prometheus scaler on `waiting + prioritized + active`, threshold 1, `minReplicaCount 0`, cooldown 5 min; a Redis-list trigger kept as a documented fallback). Upload 30 short videos at once on the k3d cluster: transcode Deployments go from 0 to their max within a minute, drain the backlog, and return to 0 after cooldown — captured as a Grafana panel (replicas vs backlog) exported to PNG. Scale-in never kills an active transcode: pods drain on `SIGTERM` within the long grace period, and if one is killed anyway the job is recovered exactly as in ticket 09. The API gets a CPU HPA.

## Acceptance criteria
- [x] `ScaledObject` per stage with per-stage `maxReplicaCount` (local: 6 transcode/4 probe; cloud overlay: 1–2); `activationThreshold 0`; HPA behaviour: fast up, slow down (stabilisation 300 s).
- [x] Burst test: backlog appears → first new pod `Running` ≤ 60 s; replicas == min(backlog, max); after drain, 0 replicas after cooldown; PNG committed under `docs/load-tests/results/`.
- [x] Scale-in during an active 1080p job: pod receives `SIGTERM`, finishes the job (grace 900 s) and exits; no stalled event.
- [x] `kubectl delete pod` of a busy worker → job recovered (09 semantics), `WorkerStalledJobs` increments once.
- [x] Redis-list fallback trigger validated on `transcode-480p` (documented limitation: ignores prioritized/active).
- [x] `ScaleToZeroBroken` alert (24) fires when the ScaledObject is intentionally paused with a backlog present (KEDA `autoscaling.keda.sh/paused-replicas` annotation), and clears when unpaused.

## Out of scope
Cloud sizing (32), compose autoscaler (27).

## Notes for the implementer
- Threshold 1 with worker concurrency 1 means one pod per outstanding job; surplus pods idle harmlessly because the queue is pulled.
- Worker `close()` must stop taking jobs immediately and wait for the active one — verify BullMQ's `worker.close(false)` semantics.

## Testing plan
Scripted burst on k3d with metric assertions via the Prometheus API; manual PNG export.

## Open questions
- ScaledJob experiment (ADR-12 #3) — optional note, not required.

## Definition of Done
- [x] AC green; PNG + short write-up in `docs/load-tests/README.md`.
