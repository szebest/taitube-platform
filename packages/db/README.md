# @vp/db — Persistence & Durability Layer

Authoritative PostgreSQL database schema and repositories for `video-pipeline`, built with Drizzle ORM and `postgres.js`. Implements compare-and-set (CAS) state transitions, fencing tokens to reject zombie workers, optimistic locking, and append-only event streams as specified in `docs/SDD.md` §5 and ADR-04.

## Durability Guarantees & Repository Methods

PostgreSQL is the source of truth; Redis is a cache of intent (SDD P2). The following repository methods encode the core durability guarantees:

### 1. `transitionVideo(db, options)`
- **Guarantee:** Compare-And-Set (CAS) atomic transition with guaranteed audit logging.
- **SQL:**
  ```sql
  UPDATE videos
  SET status = $to, updated_at = now(), ...patch
  WHERE id = $videoId AND status = $from
  RETURNING id;
  ```
- **Durability Behavior:**
  - Atomically validates that `videos.status == from` and sets `status = to`.
  - In the **same database transaction**, appends an audit event to `video_events`. There is no public API to update status without appending an event.
  - Returns `true` if this caller succeeded.
  - Returns `false` if another concurrent worker or process already transitioned the status. Callers treat `false` as "already handled" and exit cleanly without error or duplicate downstream jobs.

### 2. `claimStep(db, options)`
- **Guarantee:** Idempotent step claim with fencing token generation (SDD §5.3, §9.5).
- **SQL:**
  ```sql
  INSERT INTO processing_steps (id, video_id, step, rendition, job_id, attempt, status, worker_id, lock_token, started_at, heartbeat_at)
  VALUES ($1, $2, $3, $4, $5, $6, 'RUNNING', $7, $8, now(), now())
  ON CONFLICT (video_id, step, rendition) DO UPDATE
    SET attempt = EXCLUDED.attempt, status = 'RUNNING', worker_id = EXCLUDED.worker_id,
        lock_token = EXCLUDED.lock_token, started_at = now(), heartbeat_at = now(), error_code = NULL
    WHERE processing_steps.status <> 'DONE'
  RETURNING lock_token;
  ```
- **Durability Behavior:**
  - First attempt inserts the step row with status `RUNNING`.
  - Retries bump `attempt` and take a new, unique UUIDv7 `lock_token`.
  - If the step was already completed (`status = 'DONE'`), the `WHERE` clause rejects reopening and returns no rows (`fenced: true`, `lockToken: null`).

### 3. `completeStep(db, options)`
- **Guarantee:** Fenced completion rejecting zombie workers.
- **SQL:**
  ```sql
  UPDATE processing_steps
  SET status = 'DONE', finished_at = now(), result = $result
  WHERE video_id = $videoId AND step = $step AND rendition = $rendition AND lock_token = $lockToken;
  ```
- **Durability Behavior:**
  - Only the holder of the active `lockToken` can complete the step.
  - If a worker was partitioned, delayed, or restarted such that BullMQ re-queued the job and another worker claimed a newer token, the zombie worker updates 0 rows and receives `{ completed: false, fenced: true }`. The zombie discards its work safely.

### 4. `failStep(db, options)`
- **Guarantee:** Fenced failure recording.
- **Durability Behavior:**
  - Only the worker holding the current `lockToken` can record a step as `FAILED`.

### 5. `heartbeatStep(db, lockToken)`
- **Guarantee:** Worker liveness tracking.
- **Durability Behavior:**
  - Periodically touches `heartbeat_at = now()` while encoding or processing, powering the `WorkerStuck` alert rule.

### 6. `updateVideoMetadata(db, options)`
- **Guarantee:** Optimistic concurrency control (OCC) for video metadata edits.
- **SQL:**
  ```sql
  UPDATE videos
  SET title = COALESCE($title, title),
      description = COALESCE($description, description),
      visibility = COALESCE($visibility, visibility),
      version = version + 1,
      updated_at = now()
  WHERE id = $videoId AND version = $version
  RETURNING *;
  ```
- **Durability Behavior:**
  - Updates title, description, and visibility only if `version` matches.
  - Atomically increments `version = version + 1`.
  - If `version` does not match (0 rows affected), throws `PermanentError` with code `VERSION_CONFLICT` (HTTP 409).

### 7. `getVideoById(db, videoId)` & `getVideoWithDetails(db, videoId)`
- **Guarantee:** Consistent point reads for API responses (video, renditions, uploads).

## Commands

```bash
# Run migrations
pnpm --filter @vp/db migrate

# Verify schema drift against Drizzle schema
pnpm --filter @vp/db check

# Seed dev users and demo video
pnpm --filter @vp/db seed

# Run tests
pnpm --filter @vp/db test
bun test packages/db
```
