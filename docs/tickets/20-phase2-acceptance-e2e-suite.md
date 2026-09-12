# 20: Phase 2 acceptance — pipeline E2E suite with the hostile set (20 concurrent videos, all terminal in 15 min)

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline (exit) |
| Issue | [#20](https://github.com/szebest/taitube-platform/issues/20) |
| Size | M |
| Blocked by | 13 — Thumbnails · 14 — Segment streaming · 15 — SSE · 16 — Retries/DLQ · 17 — Housekeeping |
| Blocks | 28 |
| Spec | [SDD §18 Phase 2 DoD](../SDD.md#phase-2-real-pipeline-3-weeks) · [PRD §9 Success metrics](../PRD.md#9-success-metrics) · [SDD §14.1 Principles](../SDD.md#141-principles) |

**Status:** done

## What to build
One command (`make e2e`) uploads twenty mixed fixtures concurrently — short/long, 1080p/720p/360p, portrait, VFR, plus the hostile set — through multipart and single-PUT paths, subscribes to SSE for each, and asserts every video reaches a terminal state within 15 minutes with the expected outcome: good files `READY` with the right number of variants, thumbnails present, hostile files in the DLQ with the right codes; one transient DLQ entry replayed successfully; abandoned upload cleaned up. The suite is the executable definition of "Phase 2 done" and becomes the regression gate for Phases 3–4.

## Acceptance criteria
- [x] `make e2e` green on an 8 vCPU laptop in < 15 min against `make up-all`; runs nightly in CI with a reduced set (< 10 min).
- [x] Assertions per video: terminal status, variant count, `segment_count` matches `ceil(duration/6)`, poster/sprite present, exactly one `video.ready|failed` event, SSE stream received `snapshot → … → status`.
- [x] DLQ contains exactly the hostile files with expected codes; replaying a forced-transient entry succeeds.
- [x] A deliberately abandoned multipart upload is `ABANDONED` after the (shortened) window.
- [x] Results written to `docs/load-tests/results/<date>-e2e/` with a summary table (durations per fixture, time-to-first-playable).

## Out of scope
Performance thresholds (28), chaos (29).

## Notes for the implementer
- Reuse the reference upload client from 11 and the SSE client from 15's tests.

## Testing plan
This ticket *is* the test; review the result table in the PR.

## Open questions
- Revisit `failParentOnFailure` decision (12) with the results.

## Definition of Done
- [x] Tag `phase2-done`; results committed; SDD §18 Phase 2 DoD ticked.
