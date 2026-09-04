---
name: hexagonal-port-adapter
description: Design, implement, and maintain the dependency-inversion / ports-and-adapters architecture in video-pipeline. Use whenever adding or modifying external integrations (storage, database, caching, messaging, job queues), creating adapters, wiring composition roots, or writing in-memory unit/e2e tests.
license: MIT
metadata:
  project: video-pipeline
  spec: ARCHITECTURE.md, docs/SDD.md §4, §6, §9
---

# Hexagonal Ports & Adapters Architecture

This skill defines the dependency inversion rules and port/adapter contracts across `video-pipeline`.

## Core Principles

1. **Dependency Inversion:** Concrete SDKs (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`) MUST NEVER be imported, instantiated, or referenced outside their adapter modules in `adapters/**` and composition roots (`apps/api/src/app.ts` and `apps/worker/src/runner.ts`).
2. **Ports in `@vp/core/ports`:** Every external dependency is defined as an abstract class extending `HealthCheckable` in `core/ports/`:
   - `Database`: Persistent state, CAS transitions, worker fencing tokens, video events.
   - `StorageClient`: S3-compatible storage operations (single put, multipart lifecycle, presigned URLs, object retrieval).
   - `CacheClient`: Key-value cache and Redis Pub/Sub channels.
   - `JobQueue`: Queue dispatching, counts, metrics, pause/resume.
3. **Pure In-Memory Test Doubles:** Every port has a realistic in-memory adapter in `adapters/in-memory/` (`InMemoryDatabase`, `InMemoryStorageClient`, `InMemoryCacheClient`, `InMemoryJobQueue`). Unit tests and in-memory e2e suites must run entirely without Docker or network sockets.
4. **Dual Runtime Parity:** Worker code and adapters must execute identically under Node.js (`vitest`) and Bun (`bun test`). No `Bun.*` APIs.

## Verification Checklist

Before completing changes touching ports or adapters:
1. Run `pnpm typecheck` across all workspaces.
2. Run `pnpm test` (verify 0 failures).
3. Run `bun test` in `apps/worker` for runtime parity.
4. Verify DoD grep checks:
   - `@aws-sdk/client-s3` only appears in `packages/storage/` and `adapters/s3/`.
   - `ioredis` only appears in `adapters/redis/`.
   - `bullmq` only appears in `adapters/bullmq/` and composition roots.
   - `postgres` / `drizzle-orm` only appears in `packages/db/` and `adapters/postgres/`.
