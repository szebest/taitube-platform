# CONTEXT.md — Domain Model & Architecture Blueprint

## 1. Domain Glossary

- **Video**: The core media entity (`videos` table). Represents a user-submitted video moving through lifecycle states: `UPLOADING` &rarr; `UPLOADED` &rarr; `PROBING` &rarr; `PROCESSING` &rarr; `READY` (or `REJECTED` / `ABANDONED` / `FAILED` / `DELETED`). Controls visibility (`public`, `unlisted`, `private`) and content metadata. The vocabularies live in `@vp/domain` (`status-vocabulary.ts`).
- **Channel**: The canonical creator identity and publication home for a user (`channels` table, one per user). Holds a unique lowercase `handle`, display name, avatar and banner URLs, bio, and `subscriberCount`.
- **Upload**: An active or terminal upload session (`uploads` table). Single presigned PUT up to `S3_MULTIPART_THRESHOLD_BYTES` (100 MiB by default), multipart above it. Tracks parts, declared size, strategy, and status (`OPEN` &rarr; `COMPLETED` / `ABORTED`).
- **Rendition**: A specific encoded video ladder rung (`renditions` table), e.g., `1080p`, `720p`, `480p`, tracking independent processing states (`PENDING` &rarr; `RUNNING` &rarr; `DONE` / `FAILED` / `SKIPPED`).
- **Processing Step**: An idempotent stage execution (`processing_steps` table, `QUEUED` &rarr; `RUNNING` &rarr; `DONE` / `FAILED` / `DEAD`) fenced by a `lock_token` UUID to prevent zombie worker double-writes.
- **Video Event**: An append-only audit log row (`video_events` table) written in the same transaction as CAS state changes; SSE streams replay from it.
- **Outbox**: A row (`outbox` table) committed with a state transition that describes the job to enqueue, so a job is delivered even when the fast-path enqueue fails.
- **DLQ Entry**: A job that failed permanently or ran out of retries (`dlq_entries` table), listed, replayed or discarded by operators.
- **Ladder**: The set of output renditions computed during probe (`height <= sourceHeight`, keeping at least the lowest 480p rung). `CANONICAL_LADDER` and `RENDITIONS` live in `@vp/job-contracts`; `selectLadder` in `@vp/ffmpeg`.
- **Reaction**: A viewer's recorded sentiment (`LIKE` or `DISLIKE`) on a video (`video_reactions` table, one per viewer and video). Drives the denormalized `likesCount` / `dislikesCount` columns and their Redis cache.
- **Subscription**: A directional follower relationship linking a viewer to a creator's channel (`channel_subscriptions` table). Dictates the subscribed feed and the channel's subscriber count.
- **Category**: A platform taxonomy classification assigned to videos for curated discovery, filtering, and administration (`categories` table).
- **Comment**: Not built. `@vp/permissions` carries comment rules (`comment.rules.ts`, `CommentResource`), but no table, endpoint or service exists.
- **Problem Detail / Failure Policy**: Standardized RFC 9457 machine-readable error representation. Every failure carries an `ErrorCode` from `@vp/errors`, and `RETRY_CLASS` classifies each code as **permanent** (invalid input, unauthorized, nonexistent entity, conflict), which must not be retried, or **transient** (a dependency unavailable), which BullMQ retries with backoff.
- **Error Boundary**: The web layout (`apps/web/src/layout/containers/default-layout/default-layout.tsx`) wraps the routed page in `react-error-boundary`'s `ErrorBoundary`, so a failing page does not take down the shell.

### Architecture vocabulary

Terms that name the repository's own structure rather than the product domain. Use them verbatim; they are
defined once here and specified in full in [packages/AGENTS.md](packages/AGENTS.md).

- **Package Tier**: *where a package's code may run* — `universal` (browser and server), `server` (Node/Bun
  only) or `client` (browser only). The tier is the package's **directory** (`packages/<tier>/<name>`), not a
  reviewer's opinion, and `server` and `client` can never see each other. This is what makes `ioredis`
  unreachable from `apps/web`. _Avoid_: "platform", "environment", "scope".
- **Dependency Layer**: *which way dependencies may point* - `vp.layer` in `package.json`: T1 Foundation, T2
  Contracts and policy, T3 Domain capability, T4 Integration, T5 Application, T6 Reference tool. Dependencies point strictly down; a
  same-layer (sibling) edge is a violation, not a shortcut. Orthogonal to the tier: a package can be
  `universal` and T1, or `server` and T3. _Avoid_: "level", "depth" (depth is a property of a module's
  interface, see §2).
- **Contract Package**: a `universal` package that single-sources a shape both sides of a seam must agree on,
  so neither can drift. `@vp/api-contracts` (HTTP request/response schemas), `@vp/permissions` (CASL rules)
  and `@vp/errors` (error codes) are the three; `@vp/job-contracts` is the server-side equivalent for queue
  payloads. A type copied instead of imported from one of these is the defect the package exists to prevent.
- **Conformance Suite**: one suite run against every implementation of a seam, so a double cannot be more
  capable than production. `packages/server/adapters/__tests__/contract/` exports one factory per repository
  port and executes it against both `InMemoryRepositories` and `PostgresRepositories`. _Avoid_ using the term
  for a suite that exercises a single implementation.
- **Invariant Suite**: `tests/architecture/` — the tests that assert the repo's own rules, over the manifest
  graph and over source text, each proven against a deliberately violating fixture. It is the enforcement
  half of every "documented vs actual" gap: a rule stated only in prose has drifted, a rule with an assertion
  has not. `pnpm test:architecture` runs it, CI runs it in `lint-typecheck` ahead of lint and typecheck under a 6-second budget, and
  `pnpm boundaries` runs the manifest half as a fail-fast script before `pnpm build` and `pnpm typecheck`.
  See [ARCHITECTURE.md §6](ARCHITECTURE.md).

---

## 2. Codebase Architecture & Seam Discipline

Following the deep module principles (`codebase-design`):

### Deep Domain Services (`apps/api/src/services/`)
- All domain workflows, multi-subsystem coordination, and business invariants live inside **Deep Service Modules**:
  - `UploadService`: Encapsulates single vs multipart strategy selection, presigned S3 URL issuance, S3 `ListParts` resume inspection, `HeadObject` size verification, rejected file cleanup, CAS video state transitions, and the probe dispatch (an outbox row plus a fast-path enqueue).
  - `VideoService`: Encapsulates read access (`decideVideoRead` from `@vp/domain-rules`), CDN URL formatting, rendition progress aggregation, metadata updates, reprocess and soft delete.
- **Interface Depth**: Each service exposes a minimal interface (e.g. 5 domain methods on `UploadService`) that hides the complexity of underlying systems (Postgres, S3, BullMQ).
- **Locality**: Invariants (e.g. "only upload owner can request parts", "size must match declared bytes before UPLOADED transition") are concentrated in one module.
- **Testability**: Services are directly testable in-process across their seam without HTTP server overhead.

### Thin Transport Adapters (`apps/api/src/routes/`)
- Fastify route files are **thin transport adapters**:
  - Declare their Zod params, querystring and body schemas and render the rest of the route schema from `@vp/api-contracts` through `contractSchema` (`routes/contract-schema.ts`).
  - Apply HTTP-level concerns: rate limiting, auth extraction (`requireAuth`), status codes (`201`, `202`, `204`, `422`, `429`).
  - **Rule**: Route handlers NEVER perform direct database mutations, raw S3 SDK calls, or BullMQ queue additions. They delegate to the service layer and render its `Result` through `sendResult`.

---

## 3. Ports, Adapters & Repository Boundaries

### Dependency Inversion & Segregation
- **Ports (`@vp/core/ports`)**: Abstract class contracts. The driver-backed ones implement `HealthCheckable` (`DatabaseClient`, `StorageClient`, `MultipartStorage`, `CacheClient`, `JobQueue`, `FlowProducerPort`); `AuthorizationPort` and `TokenVerifier` do not. The cache-shaped ports (`CategoryCachePort`, `ReactionCachePort`, `SubscriptionCachePort`) sit beside them.
- **Repositories (`@vp/core/repositories`)**: Pure domain entity contracts decoupled from the driver:
  - `VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`, `DlqRepository`, `OutboxRepository`, `CategoryRepositoryPort`, `ChannelRepositoryPort`, `SubscriptionRepositoryPort`, `VideoReactionRepositoryPort`, and the aggregating `Repositories` interface.
- **Adapters (`@vp/adapters`)**: Concrete implementations (`packages/server/adapters/{s3,redis,bullmq,postgres,auth,authorization,metered,in-memory}/`).
- **Composition Roots**: `apps/api/src/app.ts` and `apps/worker/src/runner.ts` call `registerAdapters` (`packages/server/adapters/composition/register-adapters.ts`), the only place concrete adapters are built.

### Modular Repository Rules & File Limits
See [docs/standards/file-discipline.md](docs/standards/file-discipline.md) for modular single-file repository rules, size bounds (<= 250 lines target, 400 lines max), and autonomous in-memory test doubles.
See [docs/standards/authorization.md](docs/standards/authorization.md) for declarative CASL permission rules and [docs/standards/testing.md](docs/standards/testing.md) for test execution.

