# Services Layer (Domain Services & Application Logic)

## Architectural Principle: Deep Domain Services & Modular Composition

Every domain resource and entity in the API has a corresponding service in `apps/api/src/services/` (e.g. `VideoService`, `CreatorStudioService`, `UploadService`, `FeedService`, `CategoryService`, `DlqService`, `QueueService`, `ChannelService`, `ReactionService`, `SubscriptionService`, `CommentService`, `ViewService`, `AnalyticsService`, `SseService`).

Services are deep modules that encapsulate business rules, domain invariants, repository interactions, cache coordination, error classification, and entity-to-view transformations. They are completely decoupled from Fastify and HTTP transport concerns.

### Composition: shared helpers are imported, collaborators are injected
A service's collaborators arrive through its deps and are required; `composition/services.module.ts` is the one place they are built. Shared stateless helpers are plain imports:
- `CategoryService` and `FeedService` import `generateEtag`, `isNotModified` and `buildCacheHeaders` from `http-cache.ts`, the **only** ETag implementation in the repository.
- `FeedService` composes `Singleflight` from `@vp/concurrency` to coalesce concurrent misses on the same feed page.
- `QueueService` reads queue state through the `JobQueue` port, pauses and resumes queues, and guards the Bull Board UI with `requireAdmin`.
- Upload completion (`upload-complete.ts`) and reprocess (`video-lifecycle.ts`) share `probe-dispatch.ts`, so the probe job the CAS transition writes to the outbox is byte-for-byte the job the fast path enqueues.

---

## Allowed Responsibilities in Services
1. **Domain Logic & Invariants**: Enforce entity validation, business constraints (e.g. handle syntax, reserved checks, ownership verification).
2. **Repository & Port Orchestration**: Invoke the `@vp/core` repository interfaces (`VideoRepository`, `UserRepository`, `ChannelRepositoryPort`, `CategoryRepositoryPort`, `DlqRepository`, ...) and ports (`StorageClient`, `MultipartStorage`, `CacheClient`, `JobQueue`, `ReactionCachePort`).
3. **Authorization**: Decide access through a `@vp/domain-rules` rule (`decideAdminAccess`, `decideUnsubscribe`, ...) or the injected `AuthorizationPort` (`VideoService`). This is the only place in `apps/api` where an authorization decision is made (`apps/api/AGENTS.md` Rule 3); `decideAdminAccess` (`packages/universal/domain-rules/src/admin/admin-access.rule.ts`) is the single admin gate.
4. **Failures as values**: Return `Result<T, E>` whose failure carries an `ErrorCode` (`CATEGORY_NOT_FOUND`, `CHANNEL_NOT_FOUND`, `DLQ_ENTRY_NOT_FOUND`, …); the route renders it through `sendResult` (ADR-24).
5. **Data Projection & DTO Formatting**: Transform database entities into API response views (converting `Date` to ISO string, attaching CDN URLs).
6. **Caching & Invalidation**: Coordinate L1/L2 caches and invalidate caches upon state modifications.
7. **Composition**: Delegate cross-cutting operations to `http-cache.ts` and to what the composition root hands in (ports, the `Singleflight` from `@vp/concurrency`); never construct or default a collaborator.

---

## Invariants & Coding Standards
- **Decoupled from HTTP**: Services must never take Fastify `FastifyRequest` or `FastifyReply` objects. Pass pure domain parameters (e.g. `userId: string`, `input: UpdateChannelInput`).
- **Testability**: Services must be 100% unit-testable using in-memory test doubles (`InMemoryRepositories`, `InMemoryCacheClient`, `InMemoryStorageClient`) without needing a live HTTP server or database.
- **File Length Discipline**: Target <= 250 lines (strict limit: 400 lines / 10 KB per file). If a service grows large, extract sub-modules (e.g. cursor pagination, types, helpers).

---

## Directory Inventory

| Service | File | Purpose |
|---|---|---|
| - | `index.ts` | Barrel re-exporting the service modules |
| `VideoService` | `video-service.ts` | Video reads, caller video listing, public feed, reprocess and soft delete |
| `CreatorStudioService` | `creator-studio-service.ts` | The creator library, metadata, tag, category and thumbnail edits under optimistic locking, and admin takedowns; registered by `composition/studio.module.ts` |
| - | `video-lifecycle.ts` | Reprocess and soft-delete state transitions |
| - | `video-views.ts` | `VideoRecord` to client view projections, including the one playback-URL rule |
| `UploadService` | `upload-service.ts` | The upload seam routes depend on; owns the shared `UploadContext` |
| - | `upload-initiate.ts` · `upload-parts.ts` · `upload-complete.ts` · `upload-abort.ts` | One upload use case each |
| - | `upload-context.ts` | Collaborator set plus `loadOwnedUpload`, the find-then-authorize step every use case starts with |
| - | `probe-dispatch.ts` | The one probe job builder shared by upload completion and reprocess |
| - | `cursor.ts` | Keyset cursor payloads and decoders for the video, feed, subscription, comment and DLQ lists |
| `FeedService` | `feed-service.ts` | Public feed page cache, singleflight coalescing, conditional requests |
| `ChannelService` | `channel-service.ts` | Account and channel reads, channel updates, handle claims, JIT provisioning |
| `CategoryService` | `category-service.ts` | Category taxonomy queries, caching, admin CRUD, cache invalidation |
| `ReactionService` | `reaction-service.ts` | Video reactions and their cached counts |
| `SubscriptionService` | `subscription-service.ts` | Channel subscriptions and the subscribed video feed |
| `CommentService` | `comment-service.ts` | Threaded comments, the hot first page behind singleflight, moderation through `@vp/domain-rules` |
| - | `comment-views.ts` | The comment wire shape, with the creator badge |
| `ViewService` | `view-service.ts` | Playback beacons: the watch-time gate, then the Redis view buffer, never the database |
| `AnalyticsService` | `analytics-service.ts` | Creator video and channel analytics over what the view flush committed |
| `DlqService` | `dlq-service.ts` | Dead-letter queue listing, job replay with fresh suffixes, discarding |
| `QueueService` | `queue-service.ts` | Queue counts and pause state, pause/resume, the Bull Board admin guard |
| - | `http-cache.ts` | The repository's only ETag generation, conditional `If-None-Match` evaluation, `Cache-Control` header construction |
| - | `housekeeping-schedulers.ts` | Upserts the housekeeping BullMQ Job Schedulers on boot |
| `ReadinessService` | `readiness-service.ts` | `/readyz`: the drain flag first, then each dependency's health check |
| `Poller` | `poller.ts` | The one interval sampler both metric pollers run on, started only by `container.start()` |
| - | `queue-poller.ts` | Samples `bullmq_queue_jobs` and the oldest waiting job's age per queue |
| - | `sql-poller.ts` | Samples `videos_by_status` and `processing_steps_running_stale` |
| `SseService` | `sse-service.ts` | SSE snapshot assembly, event replay, stream read authorization |
| `SseHub` | `sse-hub.ts` | Registers SSE connections, pattern-subscribes to the Redis video and user channels, fans events out |
| `SseConnection` | `sse-connection.ts` | One open SSE stream: writes, heartbeat timer, close |
| - | `sse-failures.ts` | The SSE failure values (`SseUnavailable`, `SseStreamLimitReached`) |

`Singleflight` is not an `apps/api` service: it lives in `@vp/concurrency`, because it is a promise map with no
driver behind it and a service importing it from `@vp/adapters` crossed the service-to-adapter edge.
