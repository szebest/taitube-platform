# AGENTS.md — @vp/db (Database Schema, Migrations & CAS Helpers)

Instructions for any coding agent working on `@vp/db`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/db` owns the PostgreSQL schema and the Drizzle vocabulary, and exports library functions only
(no CLI, no `migrate` / `seed` scripts):
- **Schema Definitions:** Drizzle ORM tables (`src/schema.ts`, subpath `@vp/db/schema`).
- **Database Migrations:** `runMigrations(url, log)` (`src/migrate.ts`, `@vp/db/migrate`) applies the
  drizzle-kit output in `drizzle/`, skipping the run when the recorded migration hash is unchanged.
- **Development Seeds:** `seedDatabase(url, log)` (`src/seed.ts`, `@vp/db/seed`) upserts two users, a
  ready video and its renditions.
- **Connection Client:** `createDbClient(url, { max })` (the `postgres.js` pool plus the Drizzle
  instance) and `waitForDatabase` (`src/client.ts`, `@vp/db/client`).

The runners live in the API: `apps/api/src/migrate.ts` (`pnpm db:migrate`) and `apps/api/src/seed.ts`
(`pnpm db:seed`) load the environment and hand these functions a logger.

*Note:* Domain repositories are implemented in `packages/server/adapters/postgres/repositories/` implementing interfaces in `packages/server/core/repositories/`.

**Layer 2.** It depends on `@vp/domain`, `@vp/job-contracts`, `@vp/result` and `@vp/storage` (all layer 1),
`drizzle-orm` and `postgres`. It does not depend on `@vp/logger`: `runMigrations`, `seedDatabase` and
`waitForDatabase` take the structural `Log` (`info` / `warn`) from `src/client.ts`.

---

## 2. Invariants & Rules

1. **State Durability (CAS):** State updates to `videos` run through `VideoRepository.transition(options)`
   (`packages/server/adapters/postgres/repositories/postgres-video-repository.ts`), which updates the status
   only while it still matches `from` and appends to `video_events` (and optionally `outbox`) in the same
   transaction. This package holds no transition helper.
2. **Schema Drift Prevention:** Generate migrations with `pnpm --filter @vp/db generate` and verify them
   with `pnpm --filter @vp/db check` (root alias `pnpm db:check`).
3. **Deterministic Seeds:** Seed rows use fixed UUIDs and `onConflictDoUpdate`, so a rerun is idempotent.

---

## 3. Dedicated Skills & References

- **`drizzle-best-practices`**: Drizzle schema and query patterns.
- **`vp-postgres-cas-fencing`**: PostgreSQL CAS and fencing token durability.
- **`postgres-database-migration`**: Zero-downtime migration guidelines.

---

## 4. Local Commands

```bash
# Run migrations (runner in apps/api)
pnpm db:migrate

# Generate a migration from schema changes
pnpm --filter @vp/db generate

# Check for schema drift
pnpm --filter @vp/db check

# Seed development database (runner in apps/api)
pnpm db:seed

# Run tests
pnpm --filter @vp/db test
```
