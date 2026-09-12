# 17: Housekeeping stage — schedulers, upload/processing reconcilers, soft delete and object purge

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Issue | [#17](https://github.com/szebest/taitube-platform/issues/17) |
| Size | M |
| Blocked by | 11 — Multipart upload · 06 — Worker runtime |
| Blocks | 18, 20 |
| Spec | [PRD US-3](../PRD.md#51-upload) · [PRD FR-2, FR-14](../PRD.md#6-functional-requirements) · [SDD §9.8 Housekeeping schedulers](../SDD.md#98-housekeeping-job-schedulers) · [SDD §5.3 Reconciler query](../SDD.md#53-key-queries-that-encode-the-guarantees) · [SDD §7 (generations, raw retention)](../SDD.md#7-object-storage-layout) · [ADR-09](../SDD.md#adr-09-upload-completion-trigger-explicit-complete-call-server-verification-reconciler) · [ADR-16](../SDD.md#adr-16-enqueue-reliability-idempotent-enqueue-reconciler-mvp-transactional-outbox-phase-4) |

**Status:** done

## What to build
A `housekeeping` worker runs BullMQ Job Schedulers (upserted idempotently by the API on boot): every 15 min it aborts uploads stuck in `UPLOADING` for > 24 h (→ `ABANDONED`) and re-enqueues videos left `UPLOADED` with no probe step for > 5 min (healing the enqueue dual-write gap); every 10 min it marks orphaned `PROCESSING` videos `FAILED('ORPHANED')`; hourly it purges objects of soft-deleted videos and old re-process generations; nightly it removes raw sources past retention; every 30 min it sweeps stale temp dirs. `DELETE /v1/videos/:id` soft-deletes and schedules the purge.

## Acceptance criteria
- [x] Schedulers exist with the ids/crons from SDD §9.8; restarting the API twice leaves exactly one of each (`getJobSchedulers()`).
- [x] Test with shortened windows via env: an upload left `UPLOADING` → `ABANDONED` and its multipart aborted (`ListMultipartUploads` empty); an `UPLOADED` video whose probe job was deleted from Redis → re-enqueued and processed to `READY`.
- [x] `PROCESSING` video with no running step and no waiting jobs for > threshold → `FAILED('ORPHANED')` + `dlq_entries` row.
- [x] `DELETE /videos/:id` → `DELETED`, objects under `raw/` and `public/videos/{id}/` gone after the purge run (paginated delete tested with > 1 000 objects); row hard-deleted afterwards.
- [x] Old generation prefix removed after a re-process (16) once the new master is live.
- [x] All actions are CAS/`SKIP LOCKED` — two housekeeping workers running concurrently do not double-abort or double-delete (test with two in-process workers).

## Out of scope
Outbox (30), cost budget alerts (33).

## Notes for the implementer
- Keep reconciler cadence ≥ 15 min so Neon's 5-min autosuspend still triggers in the cloud (SDD §12.3 guardrail).
- Lifecycle rules remain the primary mechanism for raw expiry; the scheduler is the audit trail.

## Testing plan
Integration with env-shortened thresholds; concurrency test with two workers.

## Open questions
- Raw retention default 7 days (PRD OQ-3) — configurable, confirm before cloud deploy.

## Definition of Done
- [x] AC green; `docs/runbooks/worker-stuck.md` drafted (orphan handling).
