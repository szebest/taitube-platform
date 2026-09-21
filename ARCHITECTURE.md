# Architecture: Ports & Adapters (Hexagonal Architecture)

This document describes the architectural boundaries, ports, and adapters layer in the `video-pipeline` monorepo.

---

## 1. Architectural Principles

1. **Dependency Inversion:** High-level policy (domain services, routes, worker pipeline stages) must never import, instantiate, or depend directly on low-level details (concrete SDKs like `@aws-sdk/client-s3`, `ioredis`, `bullmq`, or Postgres/Drizzle drivers).
2. **Ports as Abstract Classes:** Every boundary is defined by an abstract class in `@vp/core/ports`. Abstract classes are used instead of pure TypeScript interfaces to allow `instanceof` checks, centralized error wrapping, and runtime health check contract enforcement.
3. **Single Injection Seam:** Concrete adapters are instantiated exclusively at composition roots (`apps/api/src/app.ts` and `apps/worker/src/runner.ts`) and injected down into domain services and worker stage processors.
4. **Interface Segregation:** Distinct responsibilities are separated into dedicated ports rather than god-objects:
   - Standard object operations live in `StorageClient`; multi-part lifecycle operations live in `MultipartStorage`.
   - Low-level database connection/transaction execution lives in `DatabaseClient`; domain entity data access lives in dedicated domain repositories (`VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`, `CategoryRepositoryPort`, `VideoReactionRepositoryPort`).
5. **Modular Single-File Repository Design:** Each repository implementation has its own separate file in `repositories/`, adhering to single responsibility and clean file sizing (target <= 250 lines).
6. **First-Class In-Memory Test Doubles:** Every port provides an in-memory adapter implementing realistic behavior (CAS transitions, fencing token validation, multipart chunk assembly, pub/sub simulation). All unit tests execute entirely in-memory with zero Docker, network sockets, or external dependencies.

---

## 2. Directory Layout

```
video-pipeline/
├── core/                           # @vp/core (Pure domain models, entities, and ports)
│   ├── domain/                     # Domain entities and value objects
│   │   ├── category.ts             # Category domain model and input interfaces
│   │   ├── reaction.ts             # Video reaction entities and count models
│   │   ├── subscription.ts         # Channel subscription entities and feed models
│   │   └── index.ts
│   ├── permissions/                # Pure domain RBAC & ABAC permission engine (re-exports @vp/permissions)
│   ├── ports/                      # Core abstract ports & domain models
│   │   ├── health-checkable.ts     # HealthCheckable interface
│   │   ├── authorization.port.ts   # AuthorizationPort (CASL declarative authorization port)
│   │   ├── database-client.ts      # Low-level DatabaseClient port (query, execute, transaction)
│   │   ├── storage-client.ts       # StorageClient port (uploadObject, downloadObject, presigning)
│   │   ├── multipart-storage.ts    # MultipartStorage port (create, presignPart, list, complete, abort)
│   │   ├── cache-client.ts         # CacheClient port (key-value, pub/sub)
│   │   ├── reaction-cache.port.ts  # ReactionCachePort (singleflight & XFetch caching)
│   │   ├── subscription-cache.port.ts # SubscriptionCachePort (Redis set & subscriber counter)
│   │   ├── job-queue.ts            # JobQueue port (enqueue, counts, pause, resume)
│   │   ├── flow-producer.ts        # FlowProducer port (flow graph additions)
│   │   └── index.ts
│   ├── pagination/                 # Shared keyset Paginator & pluggable CursorCodec
│   └── repositories/               # Domain repository interfaces
│       ├── category-repository.port.ts
│       ├── channel-repository.port.ts
│       ├── subscription-repository.port.ts
│       ├── video-reaction-repository.port.ts
│       ├── video-repository.ts
│       ├── upload-repository.ts
│       ├── step-repository.ts
│       ├── rendition-repository.ts
│       ├── event-repository.ts
│       ├── user-repository.ts
│       ├── repositories.ts         # Aggregating container interface
│       └── index.ts
│
├── adapters/                       # @vp/adapters (Concrete and in-memory adapter implementations)
│   ├── authorization/              # CaslAuthorizationAdapter (@vp/permissions bridge)
│   ├── postgres/                   # PostgreSQL repository implementations via Drizzle ORM
│   │   ├── postgres-database-client.ts
│   │   ├── scopes/                 # CASL AST -> Drizzle SQL compiler, drizzleWhere & row scopes
│   │   ├── mappers/                # Domain input -> typed Drizzle insert and update rows
│   │   ├── repositories/           # Individual Postgres repository implementations
│   │   │   ├── postgres-category-repository.ts
│   │   │   ├── postgres-channel-repository.ts
│   │   │   ├── postgres-subscription-repository.ts
│   │   │   ├── postgres-video-reaction-repository.ts
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
│   ├── redis/                      # RedisCacheClient, CategoryCacheService, RedisReactionCacheAdapter, RedisSubscriptionCacheAdapter
│   ├── bullmq/                     # BullMqJobQueue & BullMqFlowProducer (bullmq)
│   └── in-memory/                  # High-speed in-memory test doubles
│       ├── in-memory-authorization-adapter.ts
│       ├── in-memory-subscription-cache.ts
│       ├── in-memory-database-client.ts
│       ├── in-memory-storage-client.ts
│       ├── in-memory-multipart-storage.ts
│       ├── in-memory-cache-client.ts
│       ├── in-memory-job-queue.ts
│       ├── in-memory-flow-producer.ts
│       ├── repositories/           # Individual in-memory repository implementations
│       └── index.ts
│
├── apps/
│   ├── api/                        # Fastify API (Composition root: apps/api/src/app.ts)
│   ├── worker/                     # BullMQ Worker (Composition root: apps/worker/src/runner.ts)
│   └── web/                        # Taitube Web Frontend (React 19, TanStack Start/Router/Query)
│
└── packages/                       # Shared monorepo packages
    ├── config/                     # Centralized environment variable validation (Zod)
    ├── db/                         # PostgreSQL schema definitions, migrations, seeds
    ├── errors/                     # Domain and HTTP RFC 9457 error classifications
    ├── events/                     # Event definitions and Redis pub/sub dispatcher
    ├── ffmpeg/                     # FFmpeg argument builders, progress parsers, probe helpers
    ├── job-contracts/              # BullMQ job payload schemas and queue naming contracts
    ├── observability/              # OpenTelemetry, Prometheus metrics, and Pino logging
    ├── permissions/                # Pure CASL declarative authorization engine (@vp/permissions)
    ├── storage/                    # S3 object key layout and presigned URL helpers
    ├── testing/                    # Shared test utilities, fixtures, and assertion helpers
    └── tsconfig/                   # Shared TypeScript presets
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
Low-level client for executing parameterized queries, transactions, and health checks:
- `query<T>(queryText, params?)` / `execute(queryText, params?)`
- `transaction(fn)` / `checkHealth()` / `close()`

### Domain Repositories (`@vp/core/repositories`)
- **`VideoRepository`**: `findById`, `findWithDetails`, `create`, `updateMetadata` (optimistic version check), `transition` (atomic CAS with events).
- **`UploadRepository`**: `findById`, `findByVideoId`, `findWithVideo`, `create`, `updateStatus`.
- **`StepRepository`**: `claim`, `complete`, `fail` (worker fencing tokens), `heartbeat`, `findByVideoId`.
- **`RenditionRepository`**: `create`, `findByVideoId`, `update`.
- **`EventRepository`**: `create`, `findByVideoId`.
- **`UserRepository`**: `findById`, `upsert`.
- **`CategoryRepositoryPort`**: Category listing, caching, admin management.
- **`VideoReactionRepositoryPort`**: Atomic reaction recording and counter synchronization.
- **`Repositories`**: Aggregating container interface bundling domain repositories.

### `AuthorizationPort`
Abstracts user authorization, declarative rule evaluation, and RFC 9457 error gating:
- `getAbility()`: returns the active `@casl/ability` instance.
- `can(action, subject)` / `can(helper, params)`: evaluates if an action is permitted.
- `assertCan(action, subject, message?)` / `assertCan(helper, params, options)`: throws RFC 9457 `UNAUTHORIZED` (401) or `FORBIDDEN` (403) if denied.
- `forUser(user)`: returns a new `AuthorizationPort` instance scoped to the target user.

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
| `AuthorizationPort` | `CaslAuthorizationAdapter` | `PermissiveAuthorizationAdapter` / `StrictAuthorizationAdapter` |
| `DatabaseClient` | `PostgresDatabaseClient` | `InMemoryDatabaseClient` |
| `Repositories` | `PostgresRepositories` | `InMemoryRepositories` |
| `StorageClient` | `S3StorageClient` | `InMemoryStorageClient` |
| `MultipartStorage` | `S3MultipartStorage` | `InMemoryMultipartStorage` |
| `CacheClient` | `RedisCacheClient` | `InMemoryCacheClient` |
| `JobQueue` | `BullMqJobQueue` | `InMemoryJobQueue` |
| `FlowProducer` | `BullMqFlowProducer` | `InMemoryFlowProducer` |

---

## 5. Architectural Invariants

### Invariant 1: Dedicated Repository Files
- Every repository implementation MUST live in its own dedicated file inside `repositories/` subfolders:
  - `packages/server/adapters/postgres/repositories/postgres-<domain>-repository.ts`
  - `packages/server/adapters/in-memory/repositories/in-memory-<domain>-repository.ts`
- Monolithic multi-repository files are strictly forbidden.

### Invariant 2: File Length & Sizing Discipline
- Target size: `<= 250 lines` of code per file.
- Strict limit: `400 lines` (or `~10 KB`) per file.
- See [docs/standards/file-discipline.md](docs/standards/file-discipline.md).

### Invariant 3: Autonomous In-Memory Test Doubles
- In-memory test doubles manage self-contained state and expose `.clear()`.
- Repositories interact exclusively via port interfaces, never by reaching into foreign private collections.

### Invariant 4: Deep Domain Services vs Thin Transport Routes
- Route handlers in `apps/api/src/routes/` are strictly thin HTTP transport adapters.
- Domain workflows and invariants live in deep domain services in `apps/api/src/services/`.
- Maintain a `>1:1` ratio of domain services to routes via composable utilities (`HttpCacheService`, `Singleflight`, `SseHub`).
- See [apps/api/AGENTS.md](apps/api/AGENTS.md).

### Invariant 5: Package Runtime Tiers & Dependency Layers

Every workspace package answers two independent questions, and both are machine-checked.

**Where may this code run?** That is the *tier*, and it is the package's location on disk:

```
packages/universal/   runs in a browser AND on a server
packages/server/      Node/Bun only
packages/client/      browser only
```

| Tier | Packages | May depend on |
|---|---|---|
| `universal` | `api-contracts`, `errors`, `permissions`, `tsconfig` | `universal` only — no `node:*`, no server SDK |
| `server` | `adapters`, `core`, `config`, `db`, `events`, `ffmpeg`, `job-contracts`, `observability`, `storage`, `testing`, `dev-token`, `gen-video`, `upload-client`, `compose-autoscaler` | `universal` + `server` |
| `client` | `api-client` | `universal` + `client` |

Apps sit outside `packages/` and declare their tier in `package.json`: `apps/api` and `apps/worker` are
`server`, `apps/web` is `client`.

A package is `universal` only when something client-side actually consumes it. `storage`, `job-contracts`
and `events` were once declared universal despite having no client consumer — `job-contracts` carries BullMQ
queue names, which is backend vocabulary sitting in the browser-safe tier. Tier follows consumers, not
portability.

**Which way may dependencies point?** That is the *layer*, declared as `vp.layer`:

```json
"vp": { "tier": "server", "layer": 2 }
```

| Layer | Meaning | Packages |
|---|---|---|
| T1 | Foundation — no `@vp/*` runtime dependency | `errors`, `tsconfig`, `config`, `core`, `job-contracts`, `observability`, `storage`, `testing`, `dev-token`, `gen-video`, `compose-autoscaler` |
| T2 | Contracts & domain capability | `api-contracts`, `permissions`, `db`, `events`, `ffmpeg`, `upload-client` |
| T3 | Integration — concrete drivers and generated clients | `adapters`, `api-client` |
| T4 | Applications | `apps/api`, `apps/worker`, `apps/web` |

**Dependencies point strictly down.** A T2 package may depend on T1 only — never on another T2, and never
upward. Sibling imports are forbidden because they are how a layer quietly becomes a cycle. The layer is
*declared*, not derived from the graph: a derived depth can never contradict itself, which would make the
check vacuous.

#### How the boundary is enforced

Three mechanisms, strongest first:

1. **It does not resolve.** pnpm links only declared dependencies, so importing a package you did not declare
   is `error TS2307: Cannot find module '@vp/adapters'` at compile time. This is what makes a server import in
   the frontend impossible rather than merely discouraged.
2. **The build fails.** `pnpm boundaries` (`scripts/check-boundaries.ts`) validates tier compatibility, layer
   direction and tier-vs-directory agreement across every manifest. Both `pnpm build` and `pnpm typecheck` run
   it first, so a bad *declaration* — the one thing TypeScript cannot catch — fails before turbo starts.
3. **The type system.** The matching `@vp/tsconfig` preset gives `universal` and `client` packages `lib` with
   `DOM` and `types: []`, so a Node builtin or global is a type error. Specs run under
   `@vp/tsconfig/spec.json` via a package's own `tsconfig.spec.json`, so importing `vitest` cannot leak
   `@types/node` back into the package's program.

`tests/architecture/package-boundaries.test.ts` asserts the same rules in the unit suite.
Full reference, including the per-package map and the recipes: [packages/AGENTS.md](packages/AGENTS.md).

- `apps/web` must NEVER import `@vp/core`, `@vp/adapters`, `@vp/db` or any `server` package.
- The frontend talks to the backend only through `@vp/api-contracts` and `@vp/api-client`.
- For all frontend architectural patterns, see [apps/web/AGENTS.md](apps/web/AGENTS.md).

### Invariant 6: Deterministic Test Suite Parity
- No heuristic skips: test suites never swallow connection errors or skip assertions conditionally.
- Strict 1:1 parity between local developer environments and remote CI pipelines.
- Unit tests execute against in-memory doubles; database durability tests execute against PostgreSQL.
- See [docs/standards/testing.md](docs/standards/testing.md).

---

## 6. Verification & Enforcement

The repository enforces architectural boundaries through static verification:
1. `git grep "@aws-sdk/client-s3"` matches only `packages/server/adapters/s3/`.
2. `git grep "ioredis"` matches only `packages/server/adapters/redis/`.
3. `git grep "bullmq"` matches only `packages/server/adapters/bullmq/`.
4. `git grep "postgres"` and `git grep "drizzle-orm"` match only `packages/server/adapters/postgres/` and `packages/server/db`.
5. Full dual-runtime test parity under `vitest` and `bun test`.
6. Biome formatting and linting pass with zero errors (`pnpm biome check --diagnostic-level=error`).
