# Services Layer (Domain Services & Application Logic)

## Architectural Principle: Deep Domain Services & Modular Composition

Every domain resource and entity in the API has a corresponding service in `apps/api/src/services/` (e.g. `VideoService`, `UploadService`, `CategoryService`, `DlqService`, `QueueService`, `ChannelService`).

Services are deep modules that encapsulate business rules, domain invariants, repository interactions, cache coordination, error classification, and entity-to-view transformations. They are completely decoupled from Fastify and HTTP transport concerns.

### More than 1:1 Ratio: Service Composition & Reusability
We strictly maintain a **>1:1 ratio of services to routes**. In addition to resource-level domain services, we maintain smaller, generalized utility services (such as `HttpCacheService`, `Singleflight`, and `QueueService`) that higher-level domain services compose. For example:
- `CategoryService` depends on `HttpCacheService` for deterministic ETag generation, conditional evaluation (`If-None-Match`), and `Cache-Control` header assembly.
- `VideoService` leverages `Singleflight` to coalesce redundant concurrent queries under heavy load.
- `QueueService` abstracts BullMQ queue inspection, Bull Board integration, and operational queue control (pause/resume).

---

## Allowed Responsibilities in Services
1. **Domain Logic & Invariants**: Enforce entity validation, business constraints, and state transitions.
2. **Repository & Port Orchestration**: Invoke abstract ports (`VideoRepository`, `CategoryRepository`, `DlqRepository`, `StorageClient`, `CacheClient`, `JobQueue`).
3. **Error Classification**: Throw `PermanentError` or `TransientError` with RFC 9457 machine-readable error codes (`ErrorCodes.CATEGORY_NOT_FOUND`, `ErrorCodes.DLQ_ENTRY_NOT_FOUND`, etc.).
4. **Data Projection & DTO Formatting**: Transform database entities into API response views (converting `Date` to ISO string, attaching CDN URLs).
5. **Caching & Invalidation**: Coordinate L1/L2 caches and invalidate caches upon state modifications.
6. **Sub-service Composition**: Delegate specialized cross-cutting operations to shared services (`HttpCacheService`, `Singleflight`).

---

## Invariants & Coding Standards
- **Decoupled from HTTP**: Services must never take Fastify `FastifyRequest` or `FastifyReply` objects. Pass pure domain parameters (e.g. `id: string`, `input: CreateCategoryInput`).
- **Testability**: Services must be 100% unit-testable using in-memory test doubles (`InMemoryRepositories`, `InMemoryCacheClient`, `InMemoryStorageClient`) without needing a live HTTP server or database.
- **File Length Discipline**: Target <= 250 lines (strict limit: 400 lines / 10 KB per file). If a service grows large, extract sub-modules (e.g. cursor pagination, types, helpers).

---

## Directory Inventory

| Service | File | Purpose |
|---|---|---|
| `VideoService` | `video-service.ts` | Video queries, caller video listing, public feed, metadata projection |
| `UploadService` | `upload-service.ts` | Single & multipart upload initiation, parts management, completion orchestration |
| `CategoryService` | `category-service.ts` | Category taxonomy queries, caching, admin CRUD, cache invalidation |
| `DlqService` | `dlq-service.ts` | Dead-letter queue listing, job replay with fresh suffixes, discarding |
| `QueueService` | `queue-service.ts` | Queue inspection, metrics gathering, Bull Board UI integration, pause/resume |
| `HttpCacheService` | `http-cache-service.ts` | Reusable ETag generation, conditional `If-None-Match` evaluation, `Cache-Control` header construction |
| `ChannelService` | `channel-service.ts` | User profile & channel fetching, updates, handle uniqueness |
| `SseHub` | `sse-hub.ts` | Real-time SSE connections, Redis pub/sub broadcasting, heartbeat management |
| `Singleflight` | `singleflight.ts` | Request deduplication and stampede prevention for expensive concurrent reads |
