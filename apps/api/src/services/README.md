# Services Layer (Domain Services & Application Logic)

## Architectural Principle: Deep Domain Services & Modular Composition

Every domain resource and entity in the API has a corresponding service in `apps/api/src/services/` (e.g. `VideoService`, `UploadService`, `FeedService`, `CategoryService`, `DlqService`, `QueueService`, `ChannelService`, `ReactionService`, `SubscriptionService`, `SseService`).

Services are deep modules that encapsulate business rules, domain invariants, repository interactions, cache coordination, error classification, and entity-to-view transformations. They are completely decoupled from Fastify and HTTP transport concerns.

### More than 1:1 Ratio: Service Composition & Reusability
We strictly maintain a **>1:1 ratio of services to routes**. In addition to resource-level domain services, we maintain smaller, generalized utility services that higher-level domain services compose. For example:
- `CategoryService` and `FeedService` depend on `HttpCacheService` for deterministic ETag generation, conditional evaluation (`If-None-Match`), and `Cache-Control` header assembly. It is the **only** ETag implementation in the repository.
- `FeedService` composes `Singleflight` (from `packages/server/adapters/redis`) to coalesce concurrent misses on the same feed page.
- `QueueService` abstracts BullMQ queue inspection, Bull Board integration, and operational queue control (pause/resume).
- `VideoService` and `UploadService` share `probe-dispatch.ts`, so the probe job the CAS transition writes to the outbox is byte-for-byte the job the fast path enqueues.

---

## Allowed Responsibilities in Services
1. **Domain Logic & Invariants**: Enforce entity validation, business constraints (e.g. handle syntax, reserved checks, ownership verification).
2. **Repository & Port Orchestration**: Invoke abstract ports (`VideoRepository`, `UserRepository`, `ChannelRepository`, `CategoryRepository`, `DlqRepository`, `StorageClient`, `CacheClient`, `JobQueue`).
3. **Authorization**: Decide access through the injected `AuthorizationPort` with a `@vp/permissions` rule helper. This is the only place in `apps/api` where an authorization decision is made (`apps/api/AGENTS.md` Rule 3); `services/admin-access.ts` is the single admin gate.
4. **Error Classification**: Throw `PermanentError` or `TransientError` with RFC 9457 machine-readable error codes (`ErrorCodes.CATEGORY_NOT_FOUND`, `ErrorCodes.CHANNEL_NOT_FOUND`, `ErrorCodes.DLQ_ENTRY_NOT_FOUND`, etc.).
5. **Data Projection & DTO Formatting**: Transform database entities into API response views (converting `Date` to ISO string, attaching CDN URLs).
6. **Caching & Invalidation**: Coordinate L1/L2 caches and invalidate caches upon state modifications.
7. **Sub-service Composition**: Delegate specialized cross-cutting operations to shared services (`HttpCacheService`, `Singleflight`).

---

## Invariants & Coding Standards
- **Decoupled from HTTP**: Services must never take Fastify `FastifyRequest` or `FastifyReply` objects. Pass pure domain parameters (e.g. `userId: string`, `input: UpdateChannelInput`).
- **Testability**: Services must be 100% unit-testable using in-memory test doubles (`InMemoryRepositories`, `InMemoryCacheClient`, `InMemoryStorageClient`) without needing a live HTTP server or database.
- **File Length Discipline**: Target <= 250 lines (strict limit: 400 lines / 10 KB per file). If a service grows large, extract sub-modules (e.g. cursor pagination, types, helpers).

---

## Directory Inventory

| Service | File | Purpose |
|---|---|---|
| `VideoService` | `video-service.ts` | Video queries, caller video listing, public feed, metadata projection |
| — | `video-lifecycle.ts` | Reprocess and soft-delete state transitions |
| — | `video-views.ts` | `VideoRecord` to client view projections, including the one playback-URL rule |
| `UploadService` | `upload-service.ts` | The upload seam routes depend on; owns the shared `UploadContext` |
| — | `upload-initiate.ts` · `upload-parts.ts` · `upload-complete.ts` · `upload-abort.ts` | One upload use case each |
| — | `upload-context.ts` | Collaborator set plus `loadOwnedUpload`, the find-then-authorize step every use case starts with |
| — | `probe-dispatch.ts` | The one probe job builder shared by upload completion and reprocess |
| `FeedService` | `feed-service.ts` | Public feed page cache, singleflight coalescing, conditional requests |
| `ChannelService` | `channel-service.ts` | User profile & channel fetching, updates, handle uniqueness, JIT provisioning |
| `CategoryService` | `category-service.ts` | Category taxonomy queries, caching, admin CRUD, cache invalidation |
| `ReactionService` | `reaction-service.ts` | Video reactions and counter caching |
| `SubscriptionService` | `subscription-service.ts` | Channel subscriptions and the subscriber video feed |
| `DlqService` | `dlq-service.ts` | Dead-letter queue listing, job replay with fresh suffixes, discarding |
| `QueueService` | `queue-service.ts` | Queue inspection, metrics gathering, Bull Board UI integration, pause/resume |
| `HttpCacheService` | `http-cache-service.ts` | The repository's only ETag generation, conditional `If-None-Match` evaluation, `Cache-Control` header construction |
| `SseService` | `sse-service.ts` | SSE snapshot assembly, event replay, stream read authorization |
| `SseHub` | `sse-hub.ts` | Real-time SSE connections, Redis pub/sub broadcasting, heartbeat management |
| — | `admin-access.ts` | The single admin gate every operator service calls |

`Singleflight` is not an `apps/api` service: it lives in `packages/server/adapters/redis/singleflight.ts` and is imported
from `@vp/adapters`.
