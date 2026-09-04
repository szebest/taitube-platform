# CONTEXT.md — Domain Model & Architecture Blueprint

## 1. Domain Glossary

- **Video**: The core media entity (`videos` table). Represents a user-submitted video moving through lifecycle states: `UPLOADING` &rarr; `UPLOADED` &rarr; `PROBING` &rarr; `PROCESSING` &rarr; `READY` (or `REJECTED` / `ABANDONED` / `FAILED` / `DELETED`).
- **Upload**: An active or terminal upload session (`uploads` table). Can be single presigned PUT (`<= 100 MB`) or multipart (`> 100 MB`). Tracks parts, size, strategy, and status (`OPEN` &rarr; `COMPLETED` / `ABORTED`).
- **Rendition**: A specific encoded video ladder rung (`renditions` table), e.g., `1080p`, `720p`, `480p`, tracking independent processing states (`PENDING` &rarr; `RUNNING` &rarr; `DONE` / `FAILED`).
- **Processing Step**: An idempotent stage execution (`processing_steps` table) fenced by a monotonic UUIDv7 token to prevent zombie worker double-writes.
- **Video Event**: An append-only audit log row (`video_events` table) written in the exact same transaction as CAS state changes, driving SSE real-time updates and webhook dispatches.
- **Ladder**: The set of output renditions computed during probe (`height <= sourceHeight`, keeping at least the lowest 480p rung).

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
  - `VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`, and the aggregating `Repositories` container.
- **Adapters (`@vp/adapters`)**: Concrete implementations (`adapters/s3/`, `adapters/redis/`, `adapters/bullmq/`, `adapters/postgres/`, `adapters/in-memory/`).
- **Composition Roots**: Only `apps/api/src/app.ts` and `apps/worker/src/runner.ts` instantiate concrete adapters.

### Modular Repository Rules & File Limits
1. **One file per repository:** Every repository implementation lives in its own dedicated file in `repositories/` (e.g. `postgres-video-repository.ts`, `in-memory-video-repository.ts`). Never bundle multiple repository implementations into a single file.
2. **File length bounds:** Target <= 250 lines per file (hard limit: 400 lines / ~10 KB).
3. **Autonomous in-memory doubles:** In-memory repositories encapsulate their state with `.clear()`, can be instantiated independently, and communicate through port interfaces.
