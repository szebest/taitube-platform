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
- **Interface Depth**: Each service exposes a minimal interface (e.g. 5 domain methods on `UploadService`) that hides the complexity of 3 underlying systems (Postgres Drizzle, S3 Object Storage, BullMQ Queues).
- **Locality**: Invariants (e.g. "only upload owner can request parts", "size must match declared bytes before UPLOADED transition") are concentrated in one module.
- **Testability**: Services are directly testable in-process across their seam without HTTP server overhead.

### Thin Transport Adapters (`apps/api/src/routes/`)
- Fastify route files are **thin transport adapters**:
  - Define Zod route validation schemas, query/body params, and OpenAPI responses.
  - Apply HTTP-level concerns: rate limiting, auth extraction (`requireAuth`), status codes (`201`, `202`, `204`, `422`, `429`).
  - **Rule**: Route handlers NEVER perform direct database mutations, raw S3 SDK calls, or BullMQ queue additions. They delegate directly to the service layer.
