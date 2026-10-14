# This repo

Design: `docs/SDD.md` §9.5 (the crash matrix), §9.6, §14.2 (scenarios S4 to S7), §14.4.

- **Scripts and the proxy**: `tools/chaos/README.md` documents `kill-worker.sh`,
  `redis-restart.sh`, `disk-fill.sh` and `toxiproxy-toxic.sh`. Toxiproxy runs under the
  `chaos` profile of `infra/compose/docker-compose.yml` (config in `infra/compose/toxiproxy/`)
  in front of MinIO; point `S3_ENDPOINT` at it for a storage scenario.
  `infra/compose/docker-compose.chaos.yml` is the readiness run behind `make chaos-readiness`.
- **Results** go under `docs/load-tests/results/<date>-<scenario>/`, from the template in
  `docs/load-tests/README.md`.
- **What the invariants read here**: `videos` terminal (`READY` or an expected `FAILED`);
  one `video.ready` row in `video_events` per ready video; the objects under
  `videos/{id}/hls/{rung}/` are the segments plus `index.m3u8`, and `master.m3u8` exists if
  and only if the video is ready; no `RUNNING` `processing_steps` row with a stale
  `heartbeat_at`, and `FENCED_OUT` in the logs for each fenced attempt;
  `jobs_processed_total{result="stalled"}`, `dlq_entries_total` and an empty `/tmp/vp` on
  every worker.
- **Scenarios** (SDD §14.2): S4 worker kill, the partition, S5 dependency outage (a short
  one heals through retries; a long one dead-letters, fires `SystemicFailure`, and is
  replayed through `POST /admin/dlq/:id/replay`), S6 SSE fan-out with an API restart, S7
  soak. The SDD holds each scenario's numbers.
- **Temp cleanup after `SIGKILL`**: the housekeeping `tmp-sweep`.
