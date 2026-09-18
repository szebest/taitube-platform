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
│   ├── domain/                     # Domain entities and value objects
│   │   ├── category.ts             # Category domain model and input interfaces
│   │   └── index.ts
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
│       ├── category-repository.port.ts # CategoryRepositoryPort
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
│   │   │   ├── postgres-category-repository.ts
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
│   ├── redis/                      # RedisCacheClient (ioredis) & CategoryCacheService (L1 LRU + L2 Redis)
│   │   ├── redis-cache-client.ts
│   │   ├── category-cache.service.ts
│   │   └── index.ts
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
│   │   │   ├── in-memory-category-repository.ts
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
│   ├── worker/                     # BullMQ Worker (Composition root: apps/worker/src/runner.ts)
│   └── web/                        # Taitube Frontend (React 19, TanStack Start, Router, Query, Form, Table, Virtual, Vite 6)
│
├── packages/
│   ├── api-contracts/              # Single-sourced Zod schemas & DTO types for BE + FE
│   ├── api-client/                 # Type-safe client SDK + TanStack Query hooks
│   ├── job-contracts/              # BullMQ queue names, payloads, and retry policies
│   ├── db/                         # Drizzle schema, migrations, connection pools
│   ├── storage/                    # S3 key conventions & presigned URL helpers
│   ├── ffmpeg/                     # FFmpeg command builders, ladder specs, probe parser
│   ├── observability/              # Prometheus metrics, OTel tracing & logger
│   ├── events/                     # Redis Pub/Sub events & SSE event schemas
│   ├── config/                     # Shared Zod environment schemas
│   ├── errors/                     # RFC 9457 ProblemDetails & error taxonomy
│   ├── testing/                    # Test fixtures, dev tokens, doubles
│   └── tsconfig/                   # Shared TypeScript presets
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
- **`UploadRepository`**: `findById`, `findByVideoId`, `findWithVideo`, `create`, `updateStatus`.
- **`StepRepository`**: `claim`, `complete`, `fail` (worker fencing tokens), `heartbeat`, `findByVideoId`.
- **`RenditionRepository`**: `create`, `findByVideoId`, `update`.
- **`EventRepository`**: `create`, `findByVideoId`.
- **`UserRepository`**: `findById`, `upsert`.
- **`Repositories`**: Aggregating container interface bundling the six domain repositories.

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

## 5. Design Patterns & Clean Architecture Rules

### Rule 1: Single Responsibility & Dedicated Repository Files
- Every repository implementation MUST live in its own dedicated file inside `repositories/` subfolders:
  - `adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Never combine multiple domain repository implementations into one monolithic file.
- The `*Repositories` container class (e.g. `PostgresRepositories`, `InMemoryRepositories`) is strictly a lightweight factory/bundle that wires the individual instances together.

### Rule 2: Strict File Length & Size Limits
- Files must remain cohesive, understandable, and modular.
- **Target size:** <= 250 lines of code per file.
- **Strict upper limit:** 400 lines (or ~10 KB) per file.
- Any module exceeding 300 lines must be evaluated for decomposition into submodules, domain services, or extracted helper components.

### Rule 3: Interface Segregation (ISP)
- Never create god-objects that bundle disparate responsibilities.
- Standard storage operations (`StorageClient`) are cleanly segregated from chunk-level multipart operations (`MultipartStorage`).
- Driver/connection primitives (`DatabaseClient`) are segregated from entity data access (`Repositories`).

### Rule 4: Autonomous Test Doubles
- In-memory test doubles must be self-contained and autonomous:
  - Private internal collections (`Map`, `Array`) initialized by default.
  - Expose `.clear()` to allow test fixtures to reset state without recreating classes.
  - Can be instantiated independently (`new InMemoryVideoRepository()`).
  - Collaborate with other repositories via port interfaces (e.g., calling `uploadsRepo.findByVideoId` or `eventRepo.create`), NOT by directly manipulating private foreign data structures.

### Rule 5: Deep Domain Services vs Thin Transport Routes
- Route handlers in `apps/api/src/routes/` are strictly transport adapters: they validate HTTP inputs, check authorization, and format HTTP responses.
- All orchestration, multi-system transaction coordination, and business invariants live in Deep Domain Services in `apps/api/src/services/` (`UploadService`, `VideoService`).

### Rule 6: Client-Server Boundary & Contract Single-Sourcing
- **Frontend Isolation:** `apps/web` must NEVER import `core`, `adapters`, `packages/db`, or any server-only package. It interacts with the backend strictly through `@vp/api-client`.
- **Contract Single-Sourcing:** All API DTO schemas and query parameters are authored once in `packages/api-contracts` (using Zod) and consumed by both Fastify route schemas (`apps/api`) and `@vp/api-client` (`apps/web`).
- **Shared Declarative Permissions:** RBAC/ABAC rules are defined in `@vp/core/permissions` without driver dependencies and shared between backend route decorators and frontend `<Can />` authorization components.

### Rule 7: Frontend Resilience & Presentation Invariants
- **Classified Retry & Idempotent Mutation Policy:** Queries auto-retry at most 3 times with exponential backoff and randomized jitter on transient 5xx/network failures, and never on permanent 4xx errors. Mutations must never auto-retry on server responses to guarantee side-effect idempotency and prevent duplicate writes.
- **Hierarchical Error Isolation:** Route-level boundaries catch critical page-level failures (`<NotFoundRoute />`, `<ForbiddenRoute />`, `<ServerErrorRoute />`, `<RootErrorPage />`), while contextual widget boundaries (`<QueryErrorCard />`) isolate non-critical failures (e.g. comments or recommendations) to ensure primary media playback is never interrupted.
- **Layout-Stable Skeleton Placeholders:** Skeletons are strictly scoped to primary initial viewports and must strictly preserve component aspect ratios (16:9 video thumbnail, 16:3 banner) and typography heights to guarantee zero Cumulative Layout Shift (`CLS < 0.05`).

### Rule 8: URL-Driven State Architecture & Modal Deep-Linking (The STS Pattern)
- **URL as Single Source of Truth:** All active modals (`?modal=...`), drawers, active tabs, filter chips, and search facets must be reflected in the browser URL search parameters rather than ephemeral component local state (`useState`).
- **History Discipline (Push vs Replace):** Opening dialogs and major state transitions must push history (`replace: false`) so the browser Back button closes the modal naturally. Filter toggling, sort changes, seekbar scrubbing, and search pagination must replace history (`replace: true`) to avoid polluting the browser history stack.
- **Search Parameter Type-Safety:** Every frontend route must define a strict Zod `validateSearch` schema in TanStack Router.

### Rule 9: Unified TanStack Full-Stack & Server-First SSR Architecture
- **Server-First Fetching & Rendering Baseline:** All public and discovery pages (Home Feed `/`, Video Watch `/watch/$videoId`, Search `/search`, Channel Profile `/channels/$handle`, Playlists `/playlist`, and Categories) must be **server-rendered by default** using TanStack Start:
  - **Server Functions (`createServerFn`):** Execute on the Node/Nitro server, querying internal backend APIs or databases directly to eliminate browser network waterfalls and TTFB lag.
  - **Route Loaders & Query Prefetching:** Route `loader` functions prefetch server state into `QueryClient` during SSR (`await queryClient.prefetchQuery(...)`), dehydrating state directly into the streamed HTML.
  - **Zero Client Hydration Duplication:** The client hydrates the dehydrated Query cache instantly on initial load, triggering zero duplicate HTTP calls on mount.
  - **Streaming HTML & SEO Metadata:** Pages stream initial HTML with fully populated `<head>` (OpenGraph, Twitter Player Cards, `VideoObject` JSON-LD schema) and server-rendered layout markup so web crawlers and humans see complete content without executing client JavaScript.
- **The TanStack Full-Stack Ecosystem:**
  - **TanStack Start (`@tanstack/react-start`):** Nitro/Vite 6 server runtime, streaming SSR, server functions (`createServerFn`), dynamic `<head>` injection.
  - **TanStack Router (`@tanstack/react-router`):** 100% type-safe file routes, Zod search param validation (`validateSearch`), and server-side route loaders.
  - **TanStack Query (`@tanstack/react-query` v5):** Server state management, SSR dehydration/hydration, optimistic mutations, and cache invalidation.
  - **TanStack Form (`@tanstack/react-form` + `@tanstack/zod-form-adapter`):** Reactive, zero-re-render forms for uploads, metadata editing, playlists, and settings.
  - **TanStack Table (`@tanstack/react-table` v8):** Headless tables for Studio video management, Admin taxonomies, and queue inspection.
### Rule 10: Deterministic Test Suite Parity & Zero Heuristic Skips
- **No Heuristic Skips:** Test suites must never silently swallow connection errors or conditionally skip test assertions (e.g., catching DB connection errors and flagging `postgresAvailable = false`).
- **1:1 Local & CI Parity:** Test suites run with strict 1:1 parity between local developer environments and remote CI pipelines. Database durability, CAS transitions, and fencing tests run against real PostgreSQL instances provided via Docker Compose (`make up`) locally and GitHub Actions service containers in CI.
- **Port Isolation:** Domain, application service, and route handler unit tests execute deterministically against in-memory port doubles (`adapters/in-memory`), while database packages execute against real PostgreSQL to guarantee atomic durability contracts.

---

## 6. Verification & Enforcement

The repository enforces architectural boundaries through static verification:
1. `git grep "@aws-sdk/client-s3"` matches only `adapters/s3/`.
2. `git grep "ioredis"` matches only `adapters/redis/`.
3. `git grep "bullmq"` matches only `adapters/bullmq/`.
4. `git grep "postgres"` and `git grep "drizzle-orm"` match only `adapters/postgres/` and `packages/db`.
5. `apps/web` imports only from `@vp/api-client`, `@vp/api-contracts`, and pure frontend packages.
6. Full dual-runtime test parity under `vitest` and `bun test`.
7. Biome formatting and linting pass with zero errors (`pnpm biome check --diagnostic-level=error`).

