---
name: hexagonal-port-adapter
description: Design, implement, and maintain the dependency-inversion / ports-and-adapters architecture in video-pipeline. Use whenever adding or modifying external integrations (storage, database, caching, messaging, job queues), creating adapters, wiring composition roots, or writing in-memory unit/e2e tests.
license: MIT
metadata:
  project: video-pipeline
  spec: ARCHITECTURE.md, docs/SDD.md §4 (ADR-19), §6, §9
---

# Hexagonal Ports & Adapters Architecture

This skill defines the dependency inversion rules, interface segregation contracts, and modular repository standards across `video-pipeline`.

## 1. Core Principles

1. **Dependency Inversion:** Concrete SDKs (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`) MUST NEVER be imported, instantiated, or referenced outside their adapter modules in `adapters/**` and composition roots (`apps/api/src/app.ts` and `apps/worker/src/runner.ts`).
2. **Ports in `@vp/core/ports`:** Every external integration is defined as an abstract class extending `HealthCheckable`:
   - `DatabaseClient`: Low-level provider-agnostic query, execute, transaction, and health check contract.
   - `StorageClient`: S3-compatible standard object operations (`uploadObject`, `downloadObject`, `headObject`, `deleteObject`, `getObject`, `createPresignedPutUrl`).
   - `MultipartStorage`: S3 multipart lifecycle operations (`createMultipartUpload`, `createPresignedPartUrl`, `listMultipartParts`, `completeMultipartUpload`, `abortMultipartUpload`).
   - `CacheClient`: Key-value cache and Redis Pub/Sub channels (`get`, `set`, `del`, `publish`, `subscribe`, `unsubscribe`).
   - `JobQueue`: Queue dispatching, counts, metrics, pause/resume (`add`, `process`, `getJobCounts`, `getJobs`, `pause`, `resume`, `close`).
   - `FlowProducer`: BullMQ parent-child flow graph additions (`addFlow`).
3. **Domain Repositories in `@vp/core/repositories`:** Pure domain entity repositories decoupled from the database client driver:
   - `VideoRepository`: `findById`, `findWithDetails`, `create`, `updateMetadata`, `transition` (CAS).
   - `UploadRepository`: `findById`, `findByVideoId`, `findWithVideo`, `create`, `updateStatus`.
   - `StepRepository`: `claim`, `complete`, `fail` (worker fencing tokens), `heartbeat`, `findByVideoId`.
   - `RenditionRepository`: `create`, `findByVideoId`, `update`.
   - `EventRepository`: `create`, `findByVideoId`.
   - `UserRepository`: `findById`, `upsert`.
   - `Repositories`: Container bundling all domain repositories.
4. **Modular Repository Single-File Discipline:**
   - Every repository implementation MUST live in its own dedicated file inside a `repositories/` subfolder (e.g. `adapters/postgres/repositories/postgres-video-repository.ts`).
   - NEVER bundle multiple repository implementations into a single monolithic file.
   - Target file length: <= 250 lines (hard limit: 400 lines / ~10 KB per file).
5. **Autonomous In-Memory Test Doubles:**
   - Every port and repository has a high-fidelity in-memory double in `adapters/in-memory/`.
   - In-memory repositories encapsulate their own private collections (`Map` / `Array`) and expose a `.clear()` method.
   - In-memory repositories can be instantiated standalone (`new InMemoryVideoRepository()`) or wired via options objects (`{ eventsRepo, renditionsRepo, stepsRepo, uploadsRepo }`).
   - All unit tests and in-memory e2e suites run in-process without Docker, database servers, or network sockets.
6. **Dual Runtime Parity:** Worker code and adapters must execute identically under Node.js (`vitest`) and Bun (`bun test`). Never use `Bun.*` runtime APIs in shared packages or workers.

## 2. Verification Checklist

Before completing changes touching ports or adapters:
1. Run `pnpm typecheck` across all workspaces (must pass cleanly with 0 errors).
2. Run `pnpm test` (verify 100% test files pass).
3. Run `bun test apps/worker` for runtime parity.
4. Run `pnpm biome check --diagnostic-level=error` (must have 0 lint errors).
5. Verify DoD grep checks:
   - `@aws-sdk/client-s3` only appears in `adapters/s3/`.
   - `ioredis` only appears in `adapters/redis/`.
   - `bullmq` only appears in `adapters/bullmq/`.
   - `postgres` / `drizzle-orm` only appears in `packages/db/` and `adapters/postgres/`.
6. Audit file sizes:
   - No single file in `core/` or `adapters/` exceeds 400 lines or 10 KB.
