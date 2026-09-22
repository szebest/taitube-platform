# 44: Creator studio video management (metadata, thumbnails, visibility & admin overrides)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#44](https://github.com/szebest/taitube-platform/issues/44) |
| Size | M |
| Blocked by | 37 — Admin category · 38 — User identity · 39 — Declarative RBAC · 43 — Views buffer |
| Blocks | 45, 47, 60 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Ticket 84 note:** every service this ticket adds returns `Result<T, …>` from `@vp/result` and throws
> nothing. Its pure checks split by what they need: input-only predicates go to `@vp/validation`,
> entity-dependent decisions to `@vp/domain-rules` — both `universal`, so the frontend runs the identical
> function. Routes unwrap with `sendResult`, and any new error code lands in `ErrorCodes`,
> `PROBLEM_STATUS` **and** `RETRY_CLASS`. See [84](84-result-typed-error-handling-shared-domain-rules.md).

## What to build

Creators need full management over their video library equivalent to YouTube Studio: assigning categories, managing tags, switching visibility (public, unlisted, private), choosing custom thumbnails from generated sprite/posters or uploading custom ones, and viewing their video library with performance summaries.

This ticket delivers:
1. **Video metadata enrichment**:
   - Linking videos to category_id (from ticket 37).
   - Video tags array (text[] in Postgres with GIN index for search/filtering).
   - Custom thumbnail selection (custom_thumbnail_url or selected poster offset).
2. **Creator Studio Endpoints**:
   - GET /v1/creator/videos: Creator personal video library list with status (READY, PROCESSING, FAILED), visibility, views, likes, comments count, and sorting.
   - PATCH /v1/creator/videos/:id: Comprehensive metadata update (title, description, categoryId, tags, visibility, selectedThumbnail).
   - DELETE /v1/creator/videos/:id: Creator video deletion with soft-delete CAS and background asset cleanup.
3. **Admin moderation overrides**:
   - Admins can edit visibility or take down (visibility = 'private', status = 'REJECTED') any video violating terms via `@vp/permissions`.

## Acceptance criteria

- [ ] Migration adding category_id (FK to categories), tags (text[] default '{}'), and custom_thumbnail_key (text) to videos table.
- [ ] GIN index on videos.tags for tag queries.
- [ ] GET /v1/creator/videos:
  - Scoped via `drizzleWhere` with `videoOwnerScope(user)` and `notDeletedScope(videos)`.
  - Returns array of video items including viewsCount, likesCount, commentsCount, status, and visibility.
  - Supports filters by status, visibility, and pagination.
- [ ] PATCH /v1/creator/videos/:id:
  - Verifies ownership or admin via `assertCan(canUpdateVideo({ user, video }))` from `@vp/permissions` (zero manual checks).
  - Validates tags (max 30 tags, max 30 chars each).
  - Validates categoryId exists in categories table.
  - Optimistic locking via version number (prevents concurrent overwrite conflicts).
- [ ] DELETE /v1/creator/videos/:id:
  - Verifies deletion authorization via `assertCan(canDeleteVideo({ user, video }))` from `@vp/permissions`.
  - Soft-deletes video (status = 'DELETED', deleted_at = NOW()).
  - Appends video.deleted audit event in video_events.
- [ ] Integration tests verifying metadata updates, optimistic lock protection, and creator studio library query results.

## Out of scope

- Automated copyright scanning / content ID.

## Notes for the implementer

- Optimistic locking is mandatory: Include version in the payload. If version does not match database version, return 409 VERSION_CONFLICT.
- Keep repository methods modular and files <= 250 lines.

## Testing plan

- Repository tests for updating tags, category, and custom thumbnail.
- Route tests via app.inject() verifying creator studio permissions.
- Concurrency test asserting 409 conflict when two updates supply the same version.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
