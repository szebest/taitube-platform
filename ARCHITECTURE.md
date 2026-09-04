# Architecture: Ports & Adapters (Hexagonal Architecture)

This document describes the architectural boundaries, ports, and adapters layer in the `video-pipeline` monorepo.

---

## 1. Architectural Principles

1. **Dependency Inversion:** High-level policy (domain services, routes, worker pipeline stages) must never import, instantiate, or depend directly on low-level details (concrete SDKs like `@aws-sdk/client-s3`, `ioredis`, `bullmq`, or Postgres/Drizzle drivers).
2. **Ports as Abstract Classes:** Every boundary is defined by an abstract class in `@vp/core/ports`. Abstract classes are used instead of pure TypeScript interfaces to allow `instanceof` checks, centralized error wrapping, and runtime health check contract enforcement.
3. **Single Injection Seam:** Concrete adapters are instantiated exclusively at composition roots (`apps/api/src/app.ts` and `apps/worker/src/runner.ts`) and injected down into domain services and worker stage processors.
4. **Interface Segregation:** Distinct responsibilities are separated into dedicated ports rather than god-objects:
   - Standard object operations live in `StorageClient`; multi-part lifecycle operations live in `MultipartStorage`.
   - Low-level database connection/transaction execution lives in `DatabaseClient`; domain entity data access lives in dedicated domain repositories (`VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`).
5. **Modular Single-File Repository Design:** Each repository implementation has its own separate file in `repositories/`, adhering to single responsibility and clean file sizing.
6. **First-Class In-Memory Test Doubles:** Every port provides an in-memory adapter implementing realistic behavior (CAS transitions, fencing token validation, multipart chunk assembly, pub/sub simulation). All unit tests execute entirely in-memory with zero Docker, network sockets, or external dependencies.

---

## 2. Directory Layout

```
video-pipeline/
├── core/
│   ├── ports/                      # Core abstract ports & domain models
│   │   ├── health-checkable.ts     # HealthCheckable interface
│   │   ├── database-client.ts      # Low-level DatabaseClient port (query, execute, transaction)
│   │   ├── storage-client.ts       # StorageClient port (uploadObject, downloadObject, presigning)
│   │   ├── multipart-storage.ts    # MultipartStorage port (create, presignPart, list, complete, abort)
│   │   ├── cache-client.ts         # CacheClient port (key-value, pub/sub)
│   │   ├── job-queue.ts            # JobQueue port (enqueue, counts, pause, resume)
│   │   ├── flow-producer.ts        # FlowProducer port (flow graph additions)
│   │   └── index.ts
│   └── repositories/               # Domain repository interfaces
│       ├── video-repository.ts     # VideoRepository
│       ├── upload-repository.ts    # UploadRepository
│       ├── step-repository.ts      # StepRepository (fencing tokens, CAS claims)
│       ├── rendition-repository.ts # RenditionRepository
│       ├── event-repository.ts     # EventRepository
│       ├── user-repository.ts      # UserRepository
│       ├── repositories.ts         # Repositories container interface
│       └── index.ts
│
├── adapters/                       # Concrete and in-memory adapter implementations
│   ├── postgres/
│   │   ├── postgres-database-client.ts
│   │   ├── repositories/           # Individual Postgres repository implementations
│   │   │   ├── postgres-video-repository.ts
│   │   │   ├── postgres-upload-repository.ts
│   │   │   ├── postgres-step-repository.ts
│   │   │   ├── postgres-rendition-repository.ts
│   │   │   ├── postgres-event-repository.ts
│   │   │   ├── postgres-user-repository.ts
│   │   │   ├── postgres-repositories.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── s3/                         # S3StorageClient & S3MultipartStorage (@aws-sdk/client-s3)
│   ├── redis/                      # RedisCacheClient (ioredis)
│   ├── bullmq/                     # BullMqJobQueue & BullMqFlowProducer (bullmq)
│   ├── in-memory/                  # In-memory test doubles
│   │   ├── in-memory-database-client.ts
│   │   ├── in-memory-storage-client.ts
│   │   ├── in-memory-multipart-storage.ts
│   │   ├── in-memory-cache-client.ts
│   │   ├── in-memory-job-queue.ts
│   │   ├── in-memory-flow-producer.ts
│   │   ├── repositories/           # Individual in-memory repository implementations
│   │   │   ├── types.ts
│   │   │   ├── in-memory-video-repository.ts
│   │   │   ├── in-memory-upload-repository.ts
│   │   │   ├── in-memory-step-repository.ts
│   │   │   ├── in-memory-rendition-repository.ts
│   │   │   ├── in-memory-event-repository.ts
│   │   │   ├── in-memory-user-repository.ts
│   │   │   ├── in-memory-repositories.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   └── index.ts
│
├── apps/
│   ├── api/                        # Fastify API (Composition root: apps/api/src/app.ts)
│   └── worker/                     # BullMQ Worker (Composition root: apps/worker/src/runner.ts)
```

---

## 3. Core Ports & Repositories

### `HealthCheckable`
```typescript
export interface HealthCheckable {
  checkHealth(): Promise<boolean>;
}
```
All ports extend `HealthCheckable` to ensure uniform liveness and readiness monitoring across all external integrations.

### `DatabaseClient`
Low-level client for executing raw SQL, parameterized queries, transactions, and health checks:
- `query<T>(queryText, params?)` / `execute(queryText, params?)`
- `transaction(fn)` / `checkHealth()` / `close()`

### Domain Repositories (`@vp/core/repositories`)
- **`VideoRepository`**: `findById`, `findWithDetails`, `create`, `updateMetadata` (optimistic version check), `transition` (atomic CAS with events).
- **`UploadRepository`**: `findById`, `findWithVideo`, `create`, `updateStatus`.
- **`StepRepository`**: `claim`, `complete`, `fail` (worker fencing tokens), `heartbeat`, `findByVideoId`.
- **`RenditionRepository`**: `create`, `findByVideoId`, `update`.
- **`EventRepository`**: `create`, `findByVideoId`.
- **`UserRepository`**: `findById`, `upsert`.

### `StorageClient`
Abstracts standard S3-compatible object storage operations across local MinIO and Cloudflare R2:
- `uploadObject(options)` / `downloadObject(bucket, key, targetFilePath)` / `headObject(bucket, key)`
- `deleteObject(bucket, key)` / `getObject(bucket, key)`
- `createPresignedPutUrl(params)`

### `MultipartStorage`
Abstracts multi-part uploads with part-level presigning and listing:
- `createMultipartUpload(bucket, key, contentType)`
- `createPresignedPartUrl(params)`
- `listMultipartParts(bucket, key, uploadId)`
- `completeMultipartUpload(bucket, key, uploadId, parts)`
- `abortMultipartUpload(bucket, key, uploadId)`

### `CacheClient`
Abstracts key-value caching and Pub/Sub messaging:
- `get(key)` / `set(key, value, ttlSeconds?)` / `del(key)`
- `publish(channel, message)` / `subscribe(channel, handler)` / `unsubscribe(channel)`

### `JobQueue` & `FlowProducer`
Abstracts job queuing, lifecycle, and parent-child flows:
- `add(name, data, options?)` / `process(handler, options?)`
- `getJobCounts()` / `getJobs(types)`
- `addFlow(flow)`

---

## 4. Adapters (`@vp/adapters`)

| Port / Boundary | Production Adapter | In-Memory Adapter |
|-----------------|--------------------|-------------------|
| `DatabaseClient` | `PostgresDatabaseClient` | `InMemoryDatabaseClient` |
| `Repositories` | `PostgresRepositories` | `InMemoryRepositories` |
| `StorageClient` | `S3StorageClient` | `InMemoryStorageClient` |
| `MultipartStorage` | `S3MultipartStorage` | `InMemoryMultipartStorage` |
| `CacheClient` | `RedisCacheClient` | `InMemoryCacheClient` |
| `JobQueue` | `BullMqJobQueue` | `InMemoryJobQueue` |
| `FlowProducer` | `BullMqFlowProducer` | `InMemoryFlowProducer` |

---

## 5. Verification & Enforcement

The repository enforces architectural boundaries through static verification:
1. `git grep "@aws-sdk/client-s3"` matches only `adapters/s3/`.
2. `git grep "ioredis"` matches only `adapters/redis/`.
3. `git grep "bullmq"` matches only `adapters/bullmq/`.
4. `git grep "postgres"` and `git grep "drizzle-orm"` match only `adapters/postgres/` and `packages/db`.
5. Full dual-runtime test parity under `vitest` and `bun test`.
