# AGENTS.md — @vp/db (Database Schema, Migrations & CAS Helpers)

Instructions for any coding agent working on `@vp/db`.

> Tiers, layers and the import rules in full: [docs/standards/package-boundaries.md](../../../docs/standards/package-boundaries.md)
---

## 1. Scope & Purpose

`@vp/db` manages the authoritative PostgreSQL persistence contracts for `video-pipeline`:
- **Schema Definitions:** Drizzle ORM tables (`schema.ts`).
- **State Machine Helpers:** Atomic Compare-And-Set (CAS) transitions appending `video_events`.
- **Database Migrations:** Schema migrations (`migrate.ts`, Drizzle kit migrations directory).
- **Development Seeds:** Deterministic mock users, channels, and videos for local dev (`seed.ts`).
- **Connection Client:** Low-level `postgres.js` pool setup (`client.ts`).

*Note:* Domain repositories are implemented in `packages/server/adapters/postgres/repositories/` implementing interfaces in `packages/server/core/repositories/`.

---

## 2. Invariants & Rules

1. **State Durability (CAS):** State updates to `videos` must run through `transitionVideo(db, options)` which atomically modifies status and appends an audit event to `video_events` within the same transaction.
2. **Schema Drift Prevention:** Always verify migrations with `pnpm --filter @vp/db check`.
3. **Deterministic Seeds:** Seed data uses fixed UUIDs and consistent timestamps.

---

## 3. Dedicated Skills & References

- **`drizzle-best-practices`**: Drizzle schema and query patterns.
- **`vp-postgres-cas-fencing`**: PostgreSQL CAS and fencing token durability.
- **`postgres-database-migration`**: Zero-downtime migration guidelines.

---

## 4. Local Commands

```bash
# Run migrations
pnpm --filter @vp/db migrate

# Check for schema drift
pnpm --filter @vp/db check

# Seed development database
pnpm --filter @vp/db seed

# Run tests
pnpm --filter @vp/db test
```
