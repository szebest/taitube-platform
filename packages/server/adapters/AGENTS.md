# AGENTS.md — @vp/adapters (Ports Implementations & Test Doubles)

Instructions for any coding agent working on adapter drivers (`adapters`).

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
  - `adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Never combine multiple domain repository implementations into one file.
- The `*Repositories` container class is strictly a lightweight factory/bundle.

### Rule 2: Autonomous In-Memory Test Doubles
- In-memory doubles manage their own in-memory collections (`Map`, `Array`).
- Must expose `.clear()` for clean test teardown.
- Repositories communicate with each other exclusively through port interfaces, never by manipulating private foreign structures.

### Rule 3: File Length Discipline
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
