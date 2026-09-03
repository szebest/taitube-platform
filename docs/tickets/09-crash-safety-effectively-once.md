# 09: Crash safety — kill a worker mid-transcode; the video still becomes `READY` exactly once

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Size | S–M |
| Blocked by | 07 — Playable READY video |
| Blocks | — |
| Spec | [PRD US-10](../PRD.md#52-processing) · [PRD G3](../PRD.md#31-goals-mvp) · [SDD §9.5 Long-running jobs (crash matrix)](../SDD.md#95-long-running-jobs-heartbeats-crashes-double-processing) · [SDD §9.7 Idempotency](../SDD.md#97-idempotency-guarantees-per-step) · [SDD §5.3 Fenced completion](../SDD.md#53-key-queries-that-encode-the-guarantees) |

**Status:** ready-for-agent

## What to build
A repeatable test (`make chaos-kill`) uploads `m10`, waits until the 720p job is ~50 %, `kill -9`s the transcode container, and proves: the job is detected as stalled within the lock window, re-run by another/new worker, the rendition is written once (identical keys overwritten), the fenced completion of the zombie attempt (if any) is rejected, and there is exactly one `READY` transition and one `video.ready` event. Also proves a network-partitioned worker that keeps encoding cannot commit after the job was re-assigned.

## Acceptance criteria
- [ ] `make chaos-kill` passes 5/5 runs: stalled detected ≤ `lockDuration + stalledInterval` (≤ 150 s), `jobs_processed_total{result="stalled"}`-equivalent counter > 0 (log/DB until metrics exist), video `READY`, `count(video_events where type='video.ready') = 1`, `renditions.status='DONE'` once, no extra objects under the rendition prefix (object count = playlist + segments).
- [ ] Partition test (pause the container with `docker pause` for > `lockDuration`, then unpause): the paused worker's completion is fenced (`FENCED_OUT` logged, 0 rows), the fresh worker's commit wins.
- [ ] Redis restart during processing: workers reconnect, in-flight job completes or is re-queued; no video stuck (assert terminal state within 5 min).
- [ ] The scenario is documented as the first entry in `docs/load-tests/README.md` (results table skeleton).

## Out of scope
Retry/DLQ semantics for exhausted attempts (16), toxiproxy-based storage faults (29).

## Notes for the implementer
- Tune `maxStalledCount: 2` and confirm the stalled job's second run does not increment `attemptsMade` unexpectedly (BullMQ semantics differ between stalled re-queue and failure retry — record the observed behaviour).

## Testing plan
Shell/TS chaos script against compose; run manually and in a nightly CI job later (28/29).

## Open questions
- None.

## Definition of Done
- [ ] Script committed, results recorded, any BullMQ behaviour surprises written into SDD §9.5.
