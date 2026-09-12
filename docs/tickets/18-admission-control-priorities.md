# 18: Admission control and priorities — one heavy user cannot starve the others

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Issue | [#18](https://github.com/szebest/taitube-platform/issues/18) |
| Size | S |
| Blocked by | 17 — Housekeeping/reconciler |
| Blocks | — |
| Spec | [PRD FR-13](../PRD.md#6-functional-requirements) · [SDD §9.4 Concurrency rules (per-user fairness)](../SDD.md#94-worker-process-model) · [SDD §14.2 S3 fairness assertion](../SDD.md#142-scenarios) |

**Status:** done

## What to build
When a user completes an upload while already having `MAX_INFLIGHT_PER_USER` videos in `PROBING/PROCESSING`, the video stays `UPLOADED` (status `queued` in the API response) and the reconciler releases it when a slot frees up. Job priority derives from `users.tier` (`pro` before `free`). A script uploading 50 videos as one user and 5 as another shows the second user's videos finishing without waiting for the first user's backlog.

## Acceptance criteria
- [x] With `MAX_INFLIGHT_PER_USER=3`, the 4th `complete` returns 202 with `status: UPLOADED, admission: "held"`; no probe job enqueued; released by `reconcile-uploads` when in-flight < 3 (test with a 1-min cadence override).
- [x] `pro` user's probe jobs carry BullMQ priority 1, `free` priority 5; with a backlog of 20 `free` jobs and 1 worker, a newly added `pro` job runs next.
- [x] Fairness script: user B's 5 videos reach `READY` before user A's 50 finish (documented timings).

## Out of scope
BullMQ Pro groups, per-tenant queues.

## Notes for the implementer
- Prioritized jobs live in the `:prioritized` ZSET, not the `wait` list — relevant for the Redis-list KEDA fallback in 26.

## Testing plan
Integration with in-process workers; the fairness script lives with the load tests.

## Open questions
- None.

## Definition of Done
- [x] AC green; env documented in `.env.example`.
