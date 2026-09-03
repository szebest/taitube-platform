---
name: vp-chaos-toxiproxy
description: Run and extend the video-pipeline chaos and resilience checks — kill workers mid-transcode, pause containers to simulate partitions, inject storage latency/503s with toxiproxy, restart Redis, fill disks — and assert effectively-once outcomes (one READY, no orphan objects, DLQ + replay behaviour). Use for tickets 09, 16, 29 or whenever a resilience claim needs proof rather than assertion.
license: MIT
metadata:
  project: video-pipeline
  spec: docs/SDD.md §9.5, §9.6, §14.2 (S4–S7), §14.4
---

# Chaos and resilience checks

Principle P7: measure, then believe. Every resilience claim in the SDD has a script here; results are committed under `docs/load-tests/results/<date>-<scenario>/` using the template in `docs/load-tests/README.md`.

## Tooling (small scripts, no chaos platform)
| Tool | Purpose | Notes |
|---|---|---|
| `tools/chaos/kill-worker.sh <stage> [interval]` | `docker kill -s KILL` (compose) or `kubectl delete pod -l stage=<stage>` (k8s) every N s | random pod of the stage |
| `docker pause <container>` / `unpause` | network-partition simulation: process keeps running but cannot renew locks | pause longer than `lockDuration` |
| toxiproxy compose profile (`infra/compose/toxiproxy.yml`) | sits in front of MinIO on `:9000`; toxics `latency`, `timeout`, `limit_data`, HTTP 503 via a tiny proxy | point `S3_ENDPOINT` at the proxy for chaos runs |
| `tools/chaos/redis-restart.sh` | `docker restart redis` mid-run | AOF `everysec` bounds loss |
| `tools/chaos/disk-fill.sh` | fills the worker `emptyDir`/tmpfs to trigger `ENOSPC` | expect `TransientError('DISK_FULL')` + cleanup |

## Invariants to assert after every scenario (write them as a reusable checker)
1. Every video in the run is terminal (`READY` or expected `FAILED`).
2. `SELECT count(*) FROM video_events WHERE video_id=$1 AND type='video.ready'` = 1 for READY videos.
3. `renditions.status='DONE'` exactly once per rung; `segment_count = ceil(duration/6)`.
4. Object audit: `ListObjects` under `videos/{id}/hls/{rung}/` = segments + `index.m3u8`, nothing else; `master.m3u8` present iff READY.
5. `processing_steps`: no `RUNNING` rows with stale `heartbeat_at`; fenced attempts logged as `FENCED_OUT` (grep logs).
6. Metrics: `jobs_processed_total{result="stalled"}` > 0 when kills happened; `dlq_entries_total` matches expectations; `/tmp/vp` empty on all workers.

## Scenarios (SDD §14.2)
- **S4 worker kill:** 50 × `s60` in flight; `kill-worker.sh transcode-720p 45` for 5 min. Expect stalled detection ≤ `lockDuration + stalledInterval` (≤ 150 s), all READY, invariants 1–6.
- **Partition:** `docker pause` a transcode worker at ~50 % for > 120 s, unpause. Expect the paused worker to be fenced on commit; the fresh run wins.
- **S5 dependency outage:** toxiproxy 503/latency on MinIO for 60 s → all READY with retries visible (backoff ≈ 10/20/40 s ± jitter). 15 min outage → attempts exhausted → `dlq_entries`, `SystemicFailure` alert, pause queue per runbook, fix, `POST /admin/dlq/:id/replay` → READY. `redis-restart.sh` mid-run → no lost videos (reconciler heals within 15 min).
- **S6 SSE fan-out:** 5 000 k6 SSE connections on one API pod while S3 runs; API restart mid-test → clients reconnect with `Last-Event-ID`, receive `snapshot`, no missed terminal events; publish→receive p95 < 2 s using `ts` in payloads.
- **S7 soak:** 4 h at 1 upload/10 s; RSS slope < 5 %/h; `videos_by_status{PROCESSING}` returns to 0.

## Procedure for a new resilience claim
1. Write the claim as an invariant (SQL/object-store assertion).
2. Choose the smallest fault that could violate it; script it.
3. Run 5×; record pass/fail, detection time, recovery time.
4. If it fails: fix, add a regression test at the lowest level possible (unit > integration > chaos), and add a row to SDD §9.5's crash matrix.
5. Commit results + one paragraph of interpretation.

## Gotchas
- BullMQ stalled re-queue vs failure retry have different `attemptsMade` semantics — read the counters, don't assume.
- Killing with `SIGKILL` leaves no time for temp cleanup: the `tmp-sweep` scheduler must remove orphans; assert it.
- Compose `--scale` scale-in stops the newest container, possibly a busy one — that is a legitimate chaos event, not a bug.
