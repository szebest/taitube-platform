# CONTEXT.md — Domain Model & Architecture Blueprint

## 1. Domain Glossary

- **Video**: The core media entity (`videos` table). Represents a user-submitted video moving through lifecycle states: `UPLOADING` &rarr; `UPLOADED` &rarr; `PROBING` &rarr; `PROCESSING` &rarr; `READY` (or `REJECTED` / `ABANDONED` / `FAILED` / `DELETED`). Controls visibility (`PUBLIC`, `UNLISTED`, `PRIVATE`) and content metadata.
- **Channel**: The canonical creator identity and publication home for a user. Encapsulates a unique lowercase `@handle`, display name, branding assets (avatar, banner), biography, and subscriber count metrics.
- **Upload**: An active or terminal upload session (`uploads` table). Can be single presigned PUT (`<= 100 MB`) or multipart (`> 100 MB`). Tracks parts, declared size, strategy, and status (`OPEN` &rarr; `COMPLETED` / `ABORTED`).
- **Rendition**: A specific encoded video ladder rung (`renditions` table), e.g., `1080p`, `720p`, `480p`, tracking independent processing states (`PENDING` &rarr; `RUNNING` &rarr; `DONE` / `FAILED`).
- **Processing Step**: An idempotent stage execution (`processing_steps` table) fenced by a monotonic UUIDv7 token to prevent zombie worker double-writes.
- **Video Event**: An append-only audit log row (`video_events` table) written in the exact same transaction as CAS state changes, driving SSE real-time updates and webhook dispatches.
- **Ladder**: The set of output renditions computed during probe (`height <= sourceHeight`, keeping at least the lowest 480p rung).
- **Reaction**: A viewer's recorded sentiment (`LIKE` or `DISLIKE`) on a video. Maintains mutually exclusive state per viewer and drives atomic counter caches in Redis and PostgreSQL.
- **Comment**: A viewer discussion item anchored to a video. Supports hierarchical parent-child threading, author attribution, pinned status, editing flags, and moderation state.
- **Subscription**: A directional follower relationship linking a viewer to a creator's channel. Dictates the personalized subscribed feed and cached channel subscriber metrics.
- **View Session**: A playback telemetry event representing verified media consumption by a viewer. Deduplicated via a sliding cooldown window in Redis and flushed periodically to daily historical aggregates (`video_views_daily`) and total view counts.
- **Watch History**: An append/upsert log (`watch_history` table) tracking an authenticated user's per-video playback progress (`progress_seconds`), completion status, and timestamp. Powers resume playback, user library feeds, and historical re-watching.
- **User Preferences & Customization**: User-specific configuration governing visual presentation (theme: Dark, Light, OLED; accent color, card density), player behavior (default quality, playback speed, autoplay, ambient glow toggle), and privacy controls (pause watch history, clear history).
- **Playback Telemetry & Analytics Beacon**: High-throughput, privacy-preserving event stream capturing playback start latency, buffering stalls, ABR rendition switches, and second-by-second audience retention curves to drive Creator Studio dashboards and Prometheus QoS metrics.
- **Live Stream**: A real-time broadcast session (`live_streams` table) ingested via RTMP/WHIP, packaged into Low-Latency HLS (LL-HLS) sliding manifests, and automatically converted to a durable VOD video entity upon stream conclusion. Supported by a real-time Redis Pub/Sub chat sidecar.
- **Playlist**: An ordered, user-curated collection of videos with custom sequencing and visibility settings.
- **Category**: A platform taxonomy classification assigned to videos for curated discovery, filtering, and administration.
- **Multi-Resource Search Facet**: A unified query abstraction executing weighted lexical and trigram matching across disparate domain entities (`videos`, `channels`, `playlists`) with polymorphic result projection and Redis caching.
- **Problem Detail / Failure Policy**: Standardized RFC 9457 machine-readable error representation. Strictly distinguishes between **Permanent** errors (invalid input, unauthorized, nonexistent entity, conflict) which must not be retried, and **Transient** errors (network interruption, 5xx server error, rate limiting 429) that trigger classified exponential backoff and jitter.
- **Discord Integration & Community Connection**: A bidirectional platform integration connecting Taitube accounts to Discord. Features an official Discord bot (slash commands `/watch`, `/live`, `/channel`, real-time creator upload/live alert webhooks), Discord Linked Roles / subscriber sync, a voice channel "Watch Together" activity powered by the Discord Embedded App SDK with lockstep playback synchronization, and Rich Presence (RPC) status broadcasting.
- **Presentation State**:
  - **Skeleton State**: A dimensionally calibrated placeholder matching the exact aspect ratio and typography geometry of pending components (CLS < 0.05).
  - **Error Boundary**: A hierarchical UI containment boundary isolating catastrophic route failures from non-critical widget errors (e.g. failing comments do not interrupt ongoing video playback).
  - **URL State Model**: The architectural paradigm where URL search parameters serve as the canonical single source of truth for view filters, active tabs, and modal overlays (the STS pattern), guaranteeing deep-linkability, browser back-button navigation, and refresh durability.

---

## 2. Codebase Architecture & Seam Discipline

Following the deep module principles (`codebase-design`):

### Deep Domain Services (`apps/api/src/services/`)
- All domain workflows, multi-subsystem coordination, and business invariants live inside **Deep Service Modules**:
  - `UploadService`: Encapsulates single vs multipart strategy selection, presigned S3 URL issuance, S3 `ListParts` resume inspection, `HeadObject` size verification, rejected file cleanup, CAS video state transitions, and BullMQ queue dispatching.
  - `VideoService`: Encapsulates access control (private vs unlisted/public), CDN URL formatting, rendition progress aggregation, and RFC 9457 compliant projections.
- **Interface Depth**: Each service exposes a minimal interface (e.g. 5 domain methods on `UploadService`) that hides the complexity of underlying systems (Postgres, S3, BullMQ).
- **Locality**: Invariants (e.g. "only upload owner can request parts", "size must match declared bytes before UPLOADED transition") are concentrated in one module.
- **Testability**: Services are directly testable in-process across their seam without HTTP server overhead.

### Thin Transport Adapters (`apps/api/src/routes/`)
- Fastify route files are **thin transport adapters**:
  - Define Zod route validation schemas, query/body params, and OpenAPI responses.
  - Apply HTTP-level concerns: rate limiting, auth extraction (`requireAuth`), status codes (`201`, `202`, `204`, `422`, `429`).
  - **Rule**: Route handlers NEVER perform direct database mutations, raw S3 SDK calls, or BullMQ queue additions. They delegate directly to the service layer.

---

## 3. Ports, Adapters & Repository Boundaries

### Dependency Inversion & Segregation
- **Ports (`@vp/core/ports`)**: Abstract class contracts extending `HealthCheckable` (`DatabaseClient`, `StorageClient`, `MultipartStorage`, `CacheClient`, `JobQueue`, `FlowProducer`).
- **Repositories (`@vp/core/repositories`)**: Pure domain entity contracts decoupled from the driver:
  - `VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`, `CategoryRepositoryPort`, `VideoReactionRepositoryPort`, and the aggregating `Repositories` container.
- **Adapters (`@vp/adapters`)**: Concrete implementations (`adapters/s3/`, `adapters/redis/`, `adapters/bullmq/`, `adapters/postgres/`, `adapters/in-memory/`).
- **Composition Roots**: Only `apps/api/src/app.ts` and `apps/worker/src/runner.ts` instantiate concrete adapters.

### Modular Repository Rules & File Limits
See [docs/standards/file-discipline.md](docs/standards/file-discipline.md) for modular single-file repository rules, size bounds (<= 250 lines target, 400 lines max), and autonomous in-memory test doubles.
See [docs/standards/authorization.md](docs/standards/authorization.md) for declarative CASL permission rules and [docs/standards/testing.md](docs/standards/testing.md) for test execution.

