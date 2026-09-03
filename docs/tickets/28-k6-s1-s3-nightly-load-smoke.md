# 28: Load tests S1–S3 (upload storm, large file, backlog burst) with thresholds, nightly smoke, results README

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Size | L |
| Blocked by | 11 — Multipart upload · 20 — Phase 2 acceptance · 26 — KEDA autoscaling |
| Blocks | 29 |
| Spec | [PRD G8, US-1 AC, §7 NFR](../PRD.md#7-non-functional-requirements-slos) · [SDD §14 Load testing plan (S1–S3, k6 sketch, reporting)](../SDD.md#14-distributed-load-testing-chaos-plan) · [ADR-13](../SDD.md#adr-13-load-testing-k6-k6-operator-for-distributed-runs) |

**Status:** ready-for-agent

## What to build
Three k6 scenarios that turn the PRD's performance hypotheses into measurements: S1 upload storm (500 VUs presign → direct PUT → complete; proves the API is out of the data path), S2 large file (4 GB multipart with resume; proves bounded memory/disk), S3 backlog burst (1 000 uploads in a minute; proves KEDA ramp, drain time and fairness). Each has pass/fail thresholds, writes metrics to Prometheus remote-write so load and system graphs share a timeline, and produces an entry in the results README. A reduced S1 runs nightly in CI. Distributed execution via k6-operator on k3d is demonstrated for S3.

## Acceptance criteria
- [ ] S1 thresholds: presign p95 < 200 ms, p99 < 500 ms, complete p95 < 300 ms, checks > 99.5 %, zero 5xx; API container network bytes flat vs file size (proved via `docker stats`/cAdvisor panel).
- [ ] S2: API RSS < 300 MB, worker RSS < 2 GB, `worker_tmp_bytes` bounded per 14; resume after killing the VU mid-upload verified.
- [ ] S3: time-to-max-replicas ≤ 60 s, drain time recorded, small users' oldest-age < 2× heavy user's (18), 0 DLQ; run both from the laptop and via `k6-operator` `TestRun` with `parallelism: 3`.
- [ ] `load-smoke.yml` nightly: compose up → S1 at 60 VUs for 2 min → thresholds gate the job.
- [ ] `docs/load-tests/README.md` has the per-run template (commit, hardware, scenario, thresholds, drain time, realtime factors, Grafana PNG, interpretation) filled for S1–S3; PRD §7 numbers marked † are updated with measured values in the same PR.
- [ ] Preset comparison `veryfast` vs `fast` realtime factor recorded (input for ADR-07/8.2 tuning).

## Out of scope
S4–S7 chaos (29), Grafana Cloud k6 (optional note).

## Notes for the implementer
- S1 uses random bytes (probe fails by design → exercises DLQ path); S2/S3 upload real fixtures via `open()`/`SharedArray`.
- Reuse the reference upload client logic from 11 in k6 JS (no Node APIs in k6).

## Testing plan
The scenarios are the tests; CI nightly for S1.

## Open questions
- Grafana Cloud k6 (500 VU-h free) for a cloud-sourced S1 against 32 — optional.

## Definition of Done
- [ ] Thresholds pass; results committed; PRD/SDD numbers updated.
