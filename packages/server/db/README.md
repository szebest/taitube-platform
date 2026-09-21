# @vp/db — PostgreSQL Schema & Durability Layer

Authoritative PostgreSQL database schema, migrations, connection pools, and atomic state-machine helpers for `video-pipeline`, built with Drizzle ORM and `postgres.js`. Implements compare-and-set (CAS) state transitions, optimistic locking, and append-only event streams as specified in `docs/SDD.md` §5 and ADR-04.

*Note on Architecture:* Entity data-access repositories are implemented in `packages/server/adapters/postgres/repositories/` adhering to the repository interfaces in `@vp/core/repositories`.

---

## 1. Core Durability & State Machine Helpers

PostgreSQL is the source of truth; Redis is a cache of intent (SDD P2).

### `transitionVideo(db, options)`
- **Guarantee:** Compare-And-Set (CAS) atomic transition with guaranteed audit logging.
- **Durability Behavior:**
  - Atomically validates that `videos.status == from` and updates `status = to`.
  - In the **exact same database transaction**, appends an audit event to `video_events`. There is no public API to update video status without appending an audit event.
  - Returns `true` if this transition succeeded.
  - Returns `false` if another concurrent worker already transitioned the status. Callers treat `false` as "already handled" and exit cleanly without duplicate downstream jobs.

---

## 2. Drizzle Schema & Tables

- `videos`: Core media entity tracking lifecycle states (`UPLOADING`, `UPLOADED`, `PROBING`, `PROCESSING`, `READY`, `REJECTED`, `ABANDONED`, `FAILED`, `DELETED`), visibility, version, duration, and metadata.
- `uploads`: Active upload sessions tracking strategy (`single` vs `multipart`), parts, and declared size.
- `processing_steps`: Idempotent stage executions fenced by monotonic UUIDv7 `lock_token` values to reject zombie workers.
- `renditions`: Output ladder renditions (`1080p`, `720p`, `480p`) with independent processing states (`PENDING`, `RUNNING`, `DONE`, `FAILED`).
- `video_events`: Append-only immutable event stream driving real-time Server-Sent Events (SSE) and webhook dispatches.
- `users`: Identity records and role permissions.
- `channels`: Creator channel profiles, display names, and `@handles`.
- `categories`: Taxonomy classifications for video discovery and filtering.
- `video_reactions`: Viewer sentiments (`LIKE`, `DISLIKE`) with synchronized counter caches.

---

## 3. Database Commands

```bash
# Run pending migrations
pnpm --filter @vp/db migrate

# Verify schema drift against Drizzle schema
pnpm --filter @vp/db check

# Seed development database with mock users and demo media
pnpm --filter @vp/db seed

# Run durability tests
pnpm --filter @vp/db test
```
