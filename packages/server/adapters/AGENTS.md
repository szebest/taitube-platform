# AGENTS.md — @vp/adapters (Ports Implementations & Test Doubles)

Instructions for any coding agent working on adapter drivers (`adapters`).

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Architecture

`@vp/adapters` contains the concrete drivers and in-memory test doubles implementing `@vp/core/ports` and
`@vp/core/repositories`.

```
adapters/
├── auth/          # TokenVerifier: JwksTokenVerifier (IdP key set) and DevTokenVerifier (dev seed key)
├── authorization/ # CaslAuthorizationAdapter (AuthorizationPort over @vp/permissions)
├── bullmq/        # BullMqJobQueue, BullMqFlowProducer, bullMqProcessor, Bull Board queues
├── composition/   # Adapter tokens and registerAdapters: the one in-memory/external switch
├── in-memory/     # In-memory test doubles for zero-dependency unit tests
├── metered/       # MeteredStorageClient & MeteredMultipartStorage (storage op metrics)
├── postgres/      # PostgresDatabaseClient, Drizzle repositories, mappers, CASL-to-SQL scopes
├── redis/         # RedisCacheClient, pub/sub, category, reaction and subscription caches
└── s3/            # S3StorageClient & S3MultipartStorage (@aws-sdk/client-s3)
```

`registerAdapters(c, config)` registers one family behind `config.kind` and imports that family's module
on demand, so an external process never loads a test double. The root barrel exports the concrete
adapters and the composition module; the doubles are reached only through `@vp/adapters/in-memory`, and
`tests/architecture/in-memory-off-boot-path.test.ts` walks both deployables' boot graphs to hold it there.

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
- Repositories communicate with each other exclusively through port interfaces, never by manipulating private
  foreign structures.

### Rule 3: Every SDK Call Is Wrapped Where It Is Made
- Outside `@vp/result` and an entrypoint's top-level handler, this package is the only home for `catch`
  (`tests/architecture/catch-confinement.test.ts`). Write it as `tryCatch` / `fromPromise` **at the exact line
  the SDK is called** - never around a block. A wrapper around ten statements cannot say which one failed. Raw
  `catch` still exists in `bullmq/bullmq-processor.ts` (reclassifies a stage throw for BullMQ),
  `redis/redis-cache-client.ts` (isolating a throwing pub/sub listener, `quit()` fallback) and the in-memory
  queue, flow producer and cache doubles; do not add more.
- An adapter reports infra failures and the constraint violations the domain cares about
  (`HANDLE_ALREADY_TAKEN`, `CATEGORY_SLUG_CONFLICT`), and **decides nothing else**. Not-found, in-use and
  permission are rules; they live in `@vp/domain-rules`. An adapter that decides one of those has put a copy
  of the rule in every adapter.
- Classify a driver error through `postgres/pg-errors.ts`, never by reading `code` off the top-level object:
  Drizzle wraps the driver error and puts the real one on `cause`. The SQLSTATE is the only signal read -
  PGLite, which the contract suites run against, sets it too - and never the message text.
- The in-memory doubles return the **same** `Result` types as the real adapters, and the contract conformance
  suite asserts they agree on failures as well as on values - the `channels.handle` unique violation surfaces
  as `HANDLE_ALREADY_TAKEN` from both.
- **`fromPromise` takes a thunk.** An SDK builder chain runs synchronously up to its last call, so handing the
  finished promise over leaves everything before it outside the boundary.

### Rule 4: Configuration Arrives as a Value
- No adapter reads `process.env`. A driver takes an explicit connection or a prebuilt client, told apart by a
  `type` tag and switched over exhaustively (`'url'` / `'client'` for Redis, `'connection'` / `'client'` for
  `S3StorageClient`, `'storage'` for `S3MultipartStorage`, `'url'` / `'sql'` for Postgres, `'queue'` /
  `'connection'` for `BullMqJobQueue`, `'producer'` / `'connection'` for `BullMqFlowProducer`), never an
  `'x' in config` probe or an optional field whose presence picks the mode.
- A resource an adapter opens is closed by its `close()`, and the composition module that constructs it
  registers that as its disposer (`tests/architecture/shutdown-closure.test.ts`).

### Rule 5: File Length Discipline
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
