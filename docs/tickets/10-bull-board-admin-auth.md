# 10: Bull Board queue UI behind admin auth

| Field | Value |
|---|---|
| Phase | 1 — Walking skeleton |
| Size | S |
| Blocked by | 04 — API skeleton |
| Blocks | 16 |
| Spec | [PRD US-14](../PRD.md#54-operations) · [PRD FR-16](../PRD.md#6-functional-requirements) · [SDD §6.1 Admin endpoints](../SDD.md#61-endpoints) · [SDD §11 Authorisation](../SDD.md#11-security) |

**Status:** done

## What to build
An operator opens `/admin/queues`, authenticates with the admin token (or a JWT carrying the `admin` role), and sees every queue from SDD §9.1 with waiting/active/delayed/failed jobs, can inspect a job's payload and error, pause/resume a queue and retry a failed job. Anyone without admin credentials gets 401/403.

## Acceptance criteria
- [x] `/admin/queues` lists all queues in `QUEUES` (including `dlq`, created lazily); unauthenticated → 401; non-admin JWT → 403; `x-admin-token` compared in constant time.
- [x] Pausing `transcode-720p` from the UI stops new jobs from starting (verify with a queued job); resuming continues.
- [x] An admin plugin (`requireAdmin`) is reusable by later admin routes (16, 19).

## Out of scope
DLQ replay endpoints (16).

## Notes for the implementer
- Mount under the API's separate admin prefix; never expose on the metrics port.

## Testing plan
Route tests via `app.inject()`; manual UI check.

## Open questions
- None.

## Definition of Done
- [x] Screenshot in PR; documented in README "Operations".
