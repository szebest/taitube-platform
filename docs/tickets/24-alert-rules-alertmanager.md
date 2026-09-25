# 24: Alert rules + Alertmanager — forcing a DLQ entry pages you

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Issue | [#24](https://github.com/szebest/taitube-platform/issues/24) |
| Size | S–M |
| Blocked by | 22 — Metrics catalogue + dashboards |
| Blocks | 29, 33 |
| Spec | [PRD US-13](../PRD.md#54-operations) · [SDD §13.5 Alert rules table](../SDD.md#135-dashboards--alerts-committed-under-observability) · [SDD §9.6 rule 5 (systemic failure runbook)](../SDD.md#96-failure-handling-retries-dlq-poison-pills) |

**Status:** done

## What to build
The ten alert rules from SDD §13.5 are committed as Prometheus rule files, loaded locally and reusable as `PrometheusRule` objects in Kubernetes; Alertmanager routes them to a Discord/Telegram webhook with severity-based grouping. Uploading a hostile file produces a `DLQNotEmpty` notification within a minute, with a link to the runbook.

## Acceptance criteria
- [x] Rules: `DLQNotEmpty`, `QueueStarvation`, `JobFailureRateHigh`, `SystemicFailure`, `WorkerStalledJobs`, `WorkerStuck`, `ScaleToZeroBroken`, `R2ClassABudget`, `APILatencyHigh`, `WorkerTmpDiskHigh` — `promtool check rules` passes; unit tests with `promtool test rules` for at least DLQNotEmpty, QueueStarvation, JobFailureRateHigh.
- [x] Every alert carries `runbook_url` annotation pointing at `docs/runbooks/*.md` (stubs created where missing).
- [x] Hostile upload → Discord/Telegram message received (screenshot).
- [x] `WorkerStuck` uses a SQL exporter or the API's SQL poller exposing `processing_steps_running_stale`.

## Out of scope
Grafana Cloud IRM routing (33).

## Notes for the implementer
- `ScaleToZeroBroken` depends on `kube_deployment_status_replicas`; mark it Kubernetes-only in the rule file.

## Testing plan
`promtool` unit tests in CI; manual notification check.

## Open questions
- None.

## Definition of Done
- [x] Rules + tests committed; runbook stubs exist for every alert.
