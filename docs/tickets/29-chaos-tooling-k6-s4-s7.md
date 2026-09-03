# 29: Chaos tooling and scenarios S4–S7 — worker kills, dependency outages, SSE fan-out, soak

| Field | Value |
|---|---|
| Phase | 4 — Resilience & cloud |
| Size | L |
| Blocked by | 28 — Load tests S1–S3 · 24 — Alert rules |
| Blocks | — |
| Spec | [PRD G3, G4, US-9, US-10](../PRD.md#5-user-stories-acceptance-criteria) · [SDD §14.2 S4–S7](../SDD.md#142-scenarios) · [SDD §14.4 Chaos tooling](../SDD.md#144-chaos-tooling) · [SDD §9.5 crash matrix](../SDD.md#95-long-running-jobs-heartbeats-crashes-double-processing) · [SDD §9.6 systemic failure runbook](../SDD.md#96-failure-handling-retries-dlq-poison-pills) |

**Status:** ready-for-agent

## What to build
Small scripts (not a chaos platform) and four more k6 scenarios prove the resilience claims: S4 kills a random transcode pod every 45 s for 5 min while 50 videos process — every video `READY` exactly once, no orphan objects; S5 injects storage latency/503s via toxiproxy and restarts Redis — short outages self-heal, long ones land in DLQ and `SystemicFailure` fires, replay works; S6 holds 5 000 SSE connections on one API pod while S3 runs — memory bounded, publish→receive p95 < 2 s, reconnect gap-free after an API restart; S7 soaks for four hours — flat memory, clean temp dirs, no stuck videos. Results join the README.

## Acceptance criteria
- [ ] Tooling: `kill-worker.sh` (k8s + compose modes), toxiproxy compose profile fronting MinIO with latency/timeout/503 toxics, `redis-restart.sh`, `disk-fill.sh`; all documented.
- [ ] S4: 50/50 videos `READY`, one `video.ready` each, `segment_count` correct, object audit finds no extras; stalled counter > 0.
- [ ] S5: 60 s storage 503 → all READY with visible retries; 15 min outage → DLQ entries, `SystemicFailure` alert observed, queue paused per runbook, replay after recovery succeeds; Redis restart → no lost videos.
- [ ] S6: `sse_connections = 5000`, API RSS < 512 MB, p95 latency < 2 s (from `ts` in payload), API restart → clients reconnect and receive `snapshot`; no missed terminal events.
- [ ] S7: 4 h at 1 upload/10 s: RSS slope < 5 %/h, `/tmp/vp` empty between jobs, `videos_by_status{PROCESSING}` returns to 0.
- [ ] Results and interpretation committed; any newly discovered failure mode gets an SDD §9.5 row and, if needed, a follow-up ticket.

## Out of scope
Cloud-side chaos (only local/k3d).

## Notes for the implementer
- SSE in k6: use the SSE extension or `k6/experimental/streams`; document the choice.

## Testing plan
The scenarios; run S7 overnight once and record.

## Open questions
- None.

## Definition of Done
- [ ] S4–S7 pass and are documented; SDD §9.5 updated with observations.
