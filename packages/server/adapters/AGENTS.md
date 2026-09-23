# AGENTS.md — @vp/adapters (Ports Implementations & Test Doubles)

Instructions for any coding agent working on adapter drivers (`adapters`).

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Architecture

`@vp/adapters` contains the concrete drivers and in-memory test doubles implementing `@vp/core/ports` and `@vp/core/repositories`.

```
adapters/
├── bullmq/      # BullMqJobQueue & BullMqFlowProducer
├── in-memory/   # In-memory test doubles for zero-dependency unit tests
├── postgres/    # PostgresDatabaseClient & Drizzle repository implementations
├── redis/       # RedisCacheClient, pub/sub, singleflight, and reaction caching
└── s3/          # S3StorageClient & S3MultipartStorage (@aws-sdk/client-s3)
```

---

## 2. Invariants & Rules

### Rule 1: Modular Single-File Repositories
- Every repository implementation MUST live in its own dedicated file inside `repositories/` subfolders:
  - `packages/server/adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `packages/server/adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Never combine multiple domain repository implementations into one file.
- The `*Repositories` container class is strictly a lightweight factory/bundle.

### Rule 2: Autonomous In-Memory Test Doubles
- In-memory doubles manage their own in-memory collections (`Map`, `Array`).
- Must expose `.clear()` for clean test teardown.
- Repositories communicate with each other exclusively through port interfaces, never by manipulating private foreign structures.

### Rule 3: Every SDK Call Is Wrapped Where It Is Made
- This package is the only home for `catch` outside `@vp/result`, and the only form it takes is `tryCatch` /
  `fromPromise` **at the exact line the SDK is called** - never around a block. A wrapper around ten statements
  cannot say which one failed, which is the property that made `catch {}` unreviewable in the first place.
- An adapter reports infra failures and the constraint violations the domain cares about
  (`HANDLE_ALREADY_TAKEN`, `CATEGORY_SLUG_CONFLICT`), and **decides nothing else**. Not-found, in-use and
  permission are rules; they live in `@vp/domain-rules`. An adapter that decides one of those has put a copy
  of the rule in every adapter.
- Classify a driver error through `postgres/pg-errors.ts`, never by reading `code` off the top-level object:
  Drizzle wraps the driver error and puts the real one on `cause`, and PGLite (which the contract suite runs
  against) raises the same duplicate key with no SQLSTATE at all.
- The in-memory doubles return the **same** `Result` types as the real adapters, and the contract conformance
  suite asserts they agree on failures as well as on values - the `channels.handle` unique violation surfaces
  as `HANDLE_ALREADY_TAKEN` from both.
- **`fromPromise` takes a thunk.** An SDK builder chain runs synchronously up to its last call, so handing the
  finished promise over leaves everything before it outside the boundary.

### Rule 4: File Length Discipline
- Target `<= 250 lines` per file.
- Strict upper limit: `400 lines` (or `10 KB`) per file.

---

## 3. Dedicated Skills & References

- **`hexagonal-port-adapter`**: Port-and-adapter patterns and wiring.
- **`vp-postgres-cas-fencing`**: PostgreSQL CAS transitions, fencing tokens, Drizzle queries.
- **`s3-storage`**: MinIO and Cloudflare R2 S3 adapter patterns.
- **`bullmq`**: BullMQ queue and flow producer implementations.
- **Standards:**
  - File discipline: `docs/standards/file-discipline.md`
  - Architecture overview: `ARCHITECTURE.md`
  - Testing standards: `docs/standards/testing.md`

---

## 4. Local Commands

```bash
# Typecheck adapters
pnpm --filter @vp/adapters typecheck

# Run adapter unit tests
pnpm --filter @vp/adapters test

# Build package
pnpm --filter @vp/adapters build
```
