# This repo

The schema is `docs/SDD.md` §5.2 (the authoritative DDL), the video state machine §3.5,
and the guarantees §9.5, §9.7, ADR-04 and ADR-16. Root `AGENTS.md` rule 6 makes this
skill binding.

- **Transitions**: `videos.status` changes only through the CAS helper, which appends a
  `video_events` row (`video_id`, `type`, `payload`, `trace_id`) in the same transaction.
- **Fencing**: `processing_steps`, unique on `(video_id, step, rendition)`, with
  `rendition = '-'` for steps that have none; claim and complete carry `lock_token`. A
  fenced-out worker logs `FENCED_OUT`. `heartbeat_at` drives the `WorkerStuck` alert.
- **Natural keys**: `renditions (video_id, name)`, `processing_steps (video_id, step,
  rendition)`, `dlq_entries (queue, job_id, attempts_made)`.
- **Reconciler**: the `housekeeping` stage picks `UPLOADED` videos with no probe step after
  five minutes; Drizzle spells the lock `.for('update', { skipLocked: true })`
  (`postgres-video-repository.ts`, `postgres-outbox-repository.ts`).
- **Optimistic locking**: video metadata edits check `version`; a conflict is
  `VERSION_CONFLICT` (409).
- **Drizzle** lives in `packages/server/db` (schema, client, migrations); the repositories
  in `packages/server/adapters/postgres/repositories/`, one per file. Unit specs run on
  PGlite and the integration job on a real Postgres (`docs/standards/testing.md`,
  Contracts).
- In the cloud (Neon): the pooled URL for the apps, the direct URL for migrations.
