# 30: Transactional outbox — close the DB-commit-then-enqueue window

| Field | Value |
|---|---|
| Phase | 4 — Resilience & cloud |
| Issue | [#30](https://github.com/szebest/taitube-platform/issues/30) |
| Size | M |
| Blocked by | 16 — Retries/DLQ (generations, admin) |
| Blocks | — |
| Spec | [ADR-16 option 2](../SDD.md#adr-16-enqueue-reliability-idempotent-enqueue-reconciler-mvp-transactional-outbox-phase-4) · [PRD §3.3 Stretch](../PRD.md#33-stretch-phase-4-designed-for-but-not-built-in-mvp) · [SDD §5.3 (`SKIP LOCKED` pattern)](../SDD.md#53-key-queries-that-encode-the-guarantees) |

**Status:** done

## What to build
Every "state change + enqueue" pair (upload complete → probe; probe → flow; package → notify; DLQ replay) writes an `outbox` row in the same transaction as the state change; a relay (in the housekeeping worker) drains the outbox with `SKIP LOCKED` batches and performs the BullMQ `add`, marking rows published. Killing the API between commit and enqueue no longer leaves a gap for the reconciler to heal — the reconciler stays as belt-and-braces.

## Acceptance criteria
- [x] Migration adds `outbox` (id, kind, payload, created_at, published_at, attempts); all producers go through one `enqueueViaOutbox(tx, job)` helper — no direct `queue.add` outside the relay (lint rule or grep test).
- [x] Fault test: crash the API process right after commit (test hook) → the relay publishes within its interval (≤ 5 s); video reaches `READY`.
- [x] Idempotency preserved: the relay uses the same deterministic job ids; publishing twice is a no-op; rows older than 7 days pruned.
- [x] Reconciler's "missing probe job" path stays and is now expected to find nothing under normal operation (metric `reconciler_repairs_total` stays 0 during E2E).
- [x] p95 added latency from outbox to queue < 1 s locally.

## Out of scope
CDC/Debezium to Kafka (backlog).

## Notes for the implementer
- Relay concurrency 1 is enough; make the interval short (1–2 s) and use `LISTEN/NOTIFY` as an optional wake-up.

## Testing plan
Integration with a crash hook; E2E suite (20) still green.

## Open questions
- None.

## Definition of Done
- [x] AC green; ADR-16 updated to "implemented".
