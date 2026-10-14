---
name: postgres-cas-fencing
description: >-
  Effectively-once outcomes from at-least-once workers in PostgreSQL: compare-and-set state
  transitions with an event row in the same transaction, fencing tokens that reject zombie
  workers, natural-key upserts, SKIP LOCKED batches, optimistic locking. Use when writing a
  repository, a migration, a worker's commit path or a reconciler query.
license: MIT
---

# Compare-and-set and fencing tokens in Postgres

Postgres is the source of truth; a queue only carries intent. With at-least-once delivery
the same job can run twice, so every write that matters is conditional. Table design and
migrations: `design-postgres-tables`, `postgres-database-migration`,
`drizzle-best-practices`. This repo's tables, states and tests:
`references/this-repo.md`.

## 1. Compare-and-set transitions

```sql
UPDATE orders SET status = 'PACKING', updated_at = now()
WHERE id = $1 AND status = 'PAID';           -- 0 rows: another attempt moved it
```

- **One repository function** performs every transition, `transition(id, from, to, patch)`:
  the conditional update **and** the event row (`INSERT INTO order_events ...`) in one
  transaction, returning whether it won. Nothing else writes the status column.
- **The allowed transitions are a typed map** checked inside `transition()`, so an illegal
  move fails in code, not in production data.
- **A lost race is not an error**: re-read the row; at or past the target state, return
  early and emit nothing. Duplicate runs stay silent this way.

## 2. Fencing tokens

A lock or lease can expire while its holder is paused (GC, a partition, a slow child
process), and the holder then writes as if it still owned the work. Checking the lease
before writing does not help: the pause can fall between the check and the write. The
storage itself must reject the stale writer.

- **Claim** issues a new token per acquisition and stores it on the work row; a retry
  re-claims with a fresh token, and finished work is never reopened:

```sql
INSERT INTO steps (entity_id, step, attempt, status, lock_token, started_at, heartbeat_at)
VALUES ($1, $2, $3, 'RUNNING', $4, now(), now())
ON CONFLICT (entity_id, step) DO UPDATE
  SET attempt = EXCLUDED.attempt, status = 'RUNNING', lock_token = EXCLUDED.lock_token,
      started_at = now(), heartbeat_at = now()
  WHERE steps.status <> 'DONE'
RETURNING lock_token;                        -- no row: the step already finished
```

- **Every write carries the token** and matches it:

```sql
UPDATE steps SET status = 'DONE', finished_at = now(), result = $3
WHERE entity_id = $1 AND step = $2 AND lock_token = $4;   -- 0 rows: fenced out
```

- **A fenced-out worker** logs it, publishes nothing, cleans up and exits. Its side effects
  elsewhere must be harmless to repeat: the same bytes to the same object key.
- A token compared for equality works when one row holds it; when several stores must
  reject a stale writer, the token is strictly monotonic and each store rejects any token
  lower than the highest it has seen. A lock service that cannot hand out such a number
  (Redlock) cannot fence.
- **Heartbeat** with the token (`UPDATE steps SET heartbeat_at = now() WHERE lock_token =
  $1`) so hung-but-alive work is visible to an alert.

## 3. Natural-key upserts

Rows with a natural key get a unique constraint on it and are written with
`INSERT ... ON CONFLICT (<key>) DO UPDATE`, never select-then-insert (a race). A failure
handler that records failures is idempotent the same way: unique per queue, job and attempt.

## 4. Reconciler batches

```sql
SELECT o.id FROM orders o
WHERE o.status = 'PAID' AND o.updated_at < now() - interval '5 minutes'
FOR UPDATE SKIP LOCKED LIMIT 100;
```

Several reconcilers run at once without double-processing, and every action they take is
itself a compare-and-set.

## 5. Optimistic locking for user edits

`UPDATE orders SET note = $2, version = version + 1 WHERE id = $1 AND version = $3`; zero
rows is a version conflict (HTTP 409), never a silent overwrite.

## 6. Mechanics

- Write conditional SQL with the query builder's tagged `sql` template where the builder is
  awkward; never concatenate strings.
- `timestamptz` everywhere; ids generated in application code when ordering matters
  (UUIDv7).
- Migrations: expand, migrate, contract; a `lock_timeout` in every migration;
  `CREATE INDEX CONCURRENTLY` outside a transaction.

## Tests that must exist

Against a real Postgres (or an in-process one), not a double:

- two concurrent `transition()` calls from the same state: exactly one wins;
- claim, claim again, complete with the old token: fenced; complete with the new: done;
- every successful transition leaves exactly one event row;
- the reconciler query skips rows another session holds.
