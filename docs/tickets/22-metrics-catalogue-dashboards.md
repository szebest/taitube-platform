# 22: Metrics catalogue populated + queue poller + Grafana dashboards (Pipeline, Queues, Workers, API, Storage & Cost)

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Size | L |
| Blocked by | 21 — Observability stack · 12 — Flows fan-out/fan-in |
| Blocks | 24, 26, 27, 32 |
| Spec | [PRD US-13, FR-16](../PRD.md#54-operations) · [SDD §13.1 Metrics catalogue](../SDD.md#131-metrics-catalogue) · [SDD §13.5 Dashboards](../SDD.md#135-dashboards-alerts-committed-under-observability) · [SDD §12.3 cost guardrails (Class A ops)](../SDD.md#123-rung-3-cloud-reference-deployment-phase-4) |

**Status:** ready-for-agent

## What to build
Run `make e2e` with the observability profile up and watch five dashboards move in real time: videos by status and time-to-ready; per-queue waiting/prioritized/active/delayed/failed with oldest-job age and wait p95 (the future autoscaling proof panel); job duration p50/p95, transcode realtime factor by rendition and preset, FFmpeg exit codes, temp disk; API RED and SSE connections; storage ops per hour with a projection against the R2 free tier. Every metric in SDD §13.1 is populated by the API, the queue poller, or the workers.

## Acceptance criteria
- [ ] `/metrics` on API and workers exposes every §13.1 metric with samples during an E2E run (test compares the live name set to the catalogue table and fails on missing/extra names).
- [ ] Queue poller (`getJobCounts` every 5 s) drives `bullmq_queue_jobs{queue,state}` and `bullmq_queue_oldest_waiting_age_seconds`; workers drive `jobs_processed_total{queue,result}`, `job_duration_seconds`, `job_wait_seconds`, `transcode_realtime_factor{rendition,preset}`, `ffmpeg_exit_total`, `storage_ops_total`, `worker_tmp_bytes`, `dlq_entries_total`; API drives RED + `sse_connections`; a SQL poller drives `videos_by_status` and `time_to_ready_seconds`.
- [ ] Five dashboards committed as JSON, provisioned automatically, with the panels listed in SDD §13.5; a screenshot of each during `make e2e` attached to the PR.
- [ ] Storage & Cost dashboard shows projected monthly Class A ops from the last 24 h (`predict_linear`).
- [ ] Metric names documented as a table generated from code and diffed against SDD §13.1 in CI.

## Out of scope
Alert rules (24), tracing (23).

## Notes for the implementer
- Label cardinality: never label by `videoId`/`jobId`.
- `time_to_ready_seconds` bucketed by source duration class.

## Testing plan
Metric-name conformance test; dashboard JSON lint (`grafana dashboard linter`); manual review of panels.

## Open questions
- None.

## Definition of Done
- [ ] AC green; screenshots in PR; README "Dashboards".
