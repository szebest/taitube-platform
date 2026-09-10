# 27: Compose-level autoscaler — the same control loop without Kubernetes

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Size | S |
| Blocked by | 22 — Metrics catalogue |
| Blocks | — |
| Spec | [SDD §13.2 (compose-level scaler paragraph)](../SDD.md#132-keda-scaledobject-prometheus-scaler-primary) · [ADR-12 option 4](../SDD.md#adr-12-autoscaling-keda-scaledobject-per-stage-prometheus-scaler-primary-redis-list-scaler-fallback) |

**Status:** in-progress

## What to build
`pnpm compose-autoscaler` polls the API's `/metrics` every 10 s and runs `docker compose up -d --scale worker-<stage>=N --no-recreate` per stage using the same min/max/cooldown semantics as 26, so a laptop without a cluster can demonstrate queue-depth scaling and the dashboards' replicas-vs-backlog panel moves the same way.

## Acceptance criteria
- [ ] Config per stage (min, max, threshold, cooldown) via a small JSON/env; dry-run flag prints intended scale actions.
- [ ] Burst of 20 uploads on compose → transcode services scale to max, drain, scale back to min after cooldown; log of actions committed as an example.
- [ ] Never scales a service below `min` while it has active jobs (reads `active` state).

## Out of scope
Anything Kubernetes.

## Notes for the implementer
- Docker Compose scale-in stops the *newest* containers, not idle ones — accept and document (idempotent redo covers it), or stop specific idle containers by inspecting metrics per container.

## Testing plan
Manual burst run; unit for the decision function (shared with nothing else — keep it pure).

## Open questions
- None.

## Definition of Done
- [ ] Tool documented in README "Autoscaling without Kubernetes".
