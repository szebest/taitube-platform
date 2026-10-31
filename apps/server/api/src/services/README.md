# Services Layer (Domain Services & Application Logic)

## Architectural Principle: Deep Domain Services & Modular Composition

Every domain resource and entity in the API has a corresponding service in `apps/server/api/src/services/` (e.g. `VideoService`, `CreatorStudioService`, `UploadService`, `FeedService`, `CategoryService`, `DlqService`, `QueueService`, `ChannelService`, `ReactionService`, `SubscriptionService`, `CommentService`, `PlaylistService`, `WatchHistoryService`, `SearchHistoryService`, `ViewerActivityService`, `ClipService`, `PickService`, `ViewService`, `AnalyticsService`, `SseService`).

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
3. **Authorization**: Decide access through a `@vp/domain-rules` rule (`decideAdminAccess`, `decideUnsubscribe`, ...) or the injected `AuthorizationPort` (`VideoService`). This is the only place in `apps/server/api` where an authorization decision is made (`apps/server/api/AGENTS.md` Rule 3); `decideAdminAccess` (`packages/universal/domain-rules/src/admin/admin-access.rule.ts`) is the single admin gate.
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
| `ChannelService` | `channel-service.ts` | Account and channel reads, a channel's public videos, channel updates, handle claims, JIT provisioning |
| `CategoryService` | `category-service.ts` | Category taxonomy queries, caching, admin CRUD, cache invalidation |
| `ReactionService` | `reaction-service.ts` | Video reactions and their cached counts |
| `SubscriptionService` | `subscription-service.ts` | Channel subscriptions and the subscribed video feed |
| `CommentService` | `comment-service.ts` | Threaded comments, the hot first page behind singleflight, moderation through `@vp/domain-rules` |
| - | `comment-views.ts` | The comment wire shape, with the creator badge |
| `PlaylistService` | `playlist-service.ts` | Playlists and their items; reorders hand `decidePlaylistReorder` to the repository transaction |
| `WatchHistoryService` | `watch-history-service.ts` | Resumable playheads over the Redis write-behind buffer, the keyset history list |
| `SearchHistoryService` | `search-history-service.ts` | The caller's search trail: the keyset list, one entry removed (`decideSearchHistoryRemoval`), all cleared; registered by `composition/search.module.ts` |
| `RecommendationFeedbackService` | `recommendation-feedback-service.ts` | "Not interested" and hidden channels: put (the target decided by `decideRecommendationFeedbackTarget`), the keyset list, undo; every write drops the viewer's cached home page through `HomeService.forget`; registered by `composition/discovery.module.ts` |
| `ViewerActivityService` | `viewer-activity-service.ts` | The caller's liked videos (cards with `viewer` progress) and own comments, each a keyset page over a repository read scoped to readable videos |
| `ClipService` | `clip-service.ts` | Clips, references to a range of a video: create (`decideClipCreate`, the read disguised by `publicReadFailure`), read (`decideClipRead`, so a clip follows its video's visibility), the caller's keyset list and delete (`decideClipDelete`); registered by `composition/clip.module.ts` |
| `PickService` | `pick-service.ts` | Pick of the day: the current pick (the scheduled one while its video is public and `READY`, else the feed's top trending video as a `fallback`; the scheduled one held by `current-pick-cache.ts` until it ends or the feed TTL) and the admin list, schedule (`decidePickCreate`), edit (`decidePickUpdate`) and cancel (`decidePickDelete`), each write dropping the cache; views in `pick-views.ts`; registered by `composition/pick.module.ts` from the discovery module |
| `HistoryPause` | `history-pause.ts` | The one reader of `privacy.historyPaused`, which pauses watch and search history; `WatchHistoryService` and `SearchService` take it |
| - | `library-views.ts` | The playlist and watch history wire shapes |
| `PreferencesService` | `preferences-service.ts` | The account's saved preferences: the owner rule, the merge and checks in `@vp/domain-rules`, the save under optimistic locking on `version` |
| - | `preferences-views.ts` | The preferences document wire shape |
| `CaptionService` | `caption-service.ts` | Caption tracks as the caller may see them, the transcript, the per-video switch, regenerate and the channel default; registered by `composition/captions.module.ts` |
| `CaptionTrackService` | `caption-track-service.ts` | Uploaded WebVTT tracks, cue text edits and deletes, each rewriting the public `.vtt` |
| - | `caption-access.ts` · `caption-runs.ts` · `caption-views.ts` | The read and manage step both caption services start with, the speech-to-text run written to the outbox, and the caption wire shapes |
| `SearchService` | `search-service.ts` | Search and autocomplete: the Redis page cache, singleflight, the trigram fallback, the suggestion index, and the signed-in caller's first-page search history write; registered by `composition/search.module.ts` |
| - | `search-cursor.ts` · `search-views.ts` | The search cursor bound to its sort, and the search wire shapes |
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

`Singleflight` is not an `apps/server/api` service: it lives in `@vp/concurrency`, because it is a promise map with no
driver behind it and a service importing it from `@vp/adapters` crossed the service-to-adapter edge.
