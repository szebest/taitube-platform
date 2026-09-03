---
name: vp-postgres-cas-fencing
description: Encode the video-pipeline durability guarantees in PostgreSQL with Drizzle — compare-and-set state transitions that append video_events in the same transaction, fencing-token claim/complete on processing_steps to reject zombie workers, ON CONFLICT upserts on natural keys, SKIP LOCKED reconciler batches, and optimistic locking with version. Use when writing repositories, migrations, worker commit paths, or reconciler queries.
license: MIT
metadata:
  project: video-pipeline
  spec: docs/SDD.md §5, §9.5, §9.7, ADR-04, ADR-16
---

# CAS transitions and fencing tokens (Postgres + Drizzle)

Postgres is the source of truth; Redis is a cache of intent (SDD P2). These patterns make at-least-once job delivery produce effectively-once outcomes. Schema: `docs/SDD.md` §5.2 (authoritative DDL). Generic table-design/migration guidance: `design-postgres-tables`, `postgres-database-migration`, `drizzle-best-practices` skills.

## 1. Compare-and-set transitions (videos)
```sql
UPDATE videos SET status = 'PROBING', updated_at = now()
WHERE id = $1 AND status = 'UPLOADED';           -- 0 rows = someone else moved it
```
- One repository function `transition(id, from, to, patch)` performs the CAS **and** `INSERT INTO video_events (video_id, type, payload, trace_id)` in the same transaction, returning `boolean`. There must be no other way to change `videos.status`.
- Callers treat `false` as "already done by another attempt": re-read the row, and if it is at/after the target state, return early without emitting events (this is how duplicate probe/package runs stay silent).
- Allowed transitions are the state machine in SDD §3.5; encode them as a TS map and assert in `transition()`.

## 2. Fencing tokens (processing_steps)
Claim (first attempt inserts; a retry re-claims with a fresh token; a finished step is never reopened):
```sql
INSERT INTO processing_steps (id, video_id, step, rendition, job_id, attempt, status, worker_id, lock_token, started_at, heartbeat_at)
VALUES ($1,$2,$3,$4,$5,$6,'RUNNING',$7,$8,now(),now())
ON CONFLICT (video_id, step, rendition) DO UPDATE
  SET attempt = EXCLUDED.attempt, status = 'RUNNING', worker_id = EXCLUDED.worker_id,
      lock_token = EXCLUDED.lock_token, started_at = now(), heartbeat_at = now(), error_code = NULL
  WHERE processing_steps.status <> 'DONE'
RETURNING lock_token;
```
Complete/fail only with the token you hold:
```sql
UPDATE processing_steps SET status='DONE', finished_at=now(), result=$3
WHERE video_id=$1 AND step=$2 AND rendition=$4 AND lock_token=$5;   -- 0 rows => FENCED_OUT
```
- `RETURNING lock_token` null/absent from the claim (because status is `DONE`) → the step already finished: exit quietly.
- A zombie worker (network partition, still encoding after BullMQ re-queued the job) gets 0 rows on commit → log `FENCED_OUT`, publish nothing, clean temp files, exit. Its S3 writes were identical bytes to identical keys, so no harm.
- `rendition = '-'` sentinel for non-rendition steps; it is part of the unique key.
- Heartbeat: `UPDATE processing_steps SET heartbeat_at = now() WHERE lock_token = $1` on progress ticks (drives the `WorkerStuck` alert).

## 3. Natural-key upserts
`renditions (video_id, name)` and `processing_steps (video_id, step, rendition)` are unique; always `insert().onConflictDoUpdate()` on those keys — never "select then insert" (race). `dlq_entries (queue, job_id, attempts_made)` unique for idempotent failure handlers.

## 4. Reconciler batches
```sql
SELECT v.id FROM videos v
LEFT JOIN processing_steps s ON s.video_id = v.id AND s.step = 'probe'
WHERE v.status = 'UPLOADED' AND v.updated_at < now() - interval '5 minutes' AND s.id IS NULL
FOR UPDATE SKIP LOCKED LIMIT 100;
```
Two housekeeping workers can run concurrently without double-processing; every action they take is itself a CAS.

## 5. Optimistic locking for metadata
`UPDATE videos SET title=$2, version = version + 1 WHERE id=$1 AND version=$3` → 0 rows = `VERSION_CONFLICT` (409).

## 6. Drizzle specifics
- Use `sql` tagged templates for CAS/fencing where the query builder gets awkward; never string-concatenate.
- Enums as Postgres enums (SDD §5.2); `timestamptz` everywhere; UUIDv7 generated in app code.
- Migrations: expand → migrate → contract (see `postgres-database-migration`); `lock_timeout` in every migration; `CREATE INDEX CONCURRENTLY` outside transactions.
- Neon: pooled URL for the apps, direct URL for migrations; `DATABASE_POOL_MAX` ≤ 5 per pod.

## Tests that must exist
- Two concurrent `transition()` calls → exactly one `true` (real Postgres, `Promise.all`).
- Claim → claim → complete(old) returns fenced; complete(new) succeeds.
- Every transition leaves exactly one `video_events` row.
- Reconciler query skips rows locked by another session.
