# 23: OpenTelemetry tracing end-to-end — one trace from `complete` through every worker stage

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Issue | [#23](https://github.com/szebest/taitube-platform/issues/23) |
| Size | M |
| Blocked by | 21 — Observability stack · 12 — Flows fan-out/fan-in |
| Blocks | — |
| Spec | [PRD US-16](../PRD.md#54-operations) · [SDD §13.3 Tracing](../SDD.md#133-tracing-opentelemetry) · [SDD §13.4 Logging correlation](../SDD.md#134-logging) · [SDD §20 (`traceparent` field)](../SDD.md#20-appendix--job-contracts-code) |

**Status:** done

## What to build
Upload a video, copy the `trace_id` from its `upload.completed` event row, paste it into Tempo: one trace shows `POST /uploads/:id/complete` → `bullmq.process probe` → three `bullmq.process transcode-*` (each with an `ffmpeg` child span carrying exit code and redacted argv) → `thumbnail` → `package` → `notify`, with queue wait time visible as the gap between spans. Every log line for the job carries the same `traceId`/`spanId`; every `video_events` row carries `trace_id`.

## Acceptance criteria
- [x] Producers inject `traceparent` into `job.data`; the worker wrapper extracts it and starts `bullmq.process {queue}` as a child of the producer span with attributes `job.id`, `attemptsMade`, `videoId`, `queue`.
- [x] Auto-instrumentation active for Fastify, `postgres`/pg, ioredis, http on Node; on Bun the same or a documented manual fallback (finding from 06).
- [x] `ffmpeg` spans include duration, exit code, `rendition`, redacted command; no presigned URLs in attributes.
- [x] Sampling configurable via env (`always_on` locally); traces exported to the local collector → Tempo; Grafana "trace to logs" link works via `traceId` in Loki lines.
- [x] A trace for the `s60` E2E has ≥ 8 spans across ≥ 4 services and is screenshotted in the PR.

## Out of scope
Grafana Cloud export (32).

## Notes for the implementer
- Long spans (25-min transcodes) are fine; keep `ffmpeg` progress out of spans (metrics/logs instead).

## Testing plan
Integration with an in-memory exporter asserting parent/child relationships; manual Tempo check.

## Open questions
- None.

## Definition of Done
- [x] AC green; README "Following a video through the system".
