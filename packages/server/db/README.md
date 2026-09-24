# @vp/db - PostgreSQL Schema & Migrations

The PostgreSQL schema, migrations, seed rows and connection client for `video-pipeline`, built with Drizzle ORM
and `postgres.js` (`docs/SDD.md` §5, ADR-04). It exports library functions only; the rules for changing it are in
[AGENTS.md](AGENTS.md).

Entity data access lives in `packages/server/adapters/postgres/repositories/`, behind the contracts in
`@vp/core/repositories`. The compare-and-set video transition, with its `video_events` append in the same
transaction, is `VideoRepository.transition` there.

## Tables

`users`, `channels`, `categories`, `videos`, `uploads`, `renditions`, `processing_steps` (fenced by a UUIDv7
`lock_token`), `video_events` (append-only, read by SSE replay), `dlq_entries`, `outbox`, `video_reactions`,
`channel_subscriptions` - all in `src/schema.ts`, with the status enums taken from `@vp/domain`.

## Commands

```bash
# Apply pending migrations (the runner is apps/api/src/migrate.ts)
pnpm db:migrate

# Seed a development database (apps/api/src/seed.ts; refuses production)
pnpm db:seed

# Generate a migration from schema changes, and check the migrations for drift
pnpm --filter @vp/db generate
pnpm --filter @vp/db check

# Specs
pnpm --filter @vp/db test
```
