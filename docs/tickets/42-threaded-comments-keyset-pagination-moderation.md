# 42: Threaded video comments with keyset pagination & moderation

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#42](https://github.com/szebest/taitube-platform/issues/42) |
| Size | L |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC |
| Blocks | 45, 76 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

The original frontend expected full comment interactions (GET /videos/:id/comments, POST /videos/:id/comments, PATCH /videos/:id/comments/:id, DELETE /videos/:id/comments/:id) but lacked hierarchical replies, pinned comments, author badges, and scalable keyset pagination.

This ticket delivers:
1. **Threaded / Hierarchical Comment Model**: Root comments (`parent_id IS NULL`) with 1-level reply nesting (`parent_id = root_comment_id`).
2. **Dual-Sort Keyset Pagination**:
   - `sort=top` (default): Keyset cursor on `(is_pinned DESC, like_count DESC, created_at DESC, id DESC)`.
   - `sort=newest`: Keyset cursor on `(is_pinned DESC, created_at DESC, id DESC)`.
3. **Hot Comments Cache & Singleflight**:
   - Top 20 comments and total comment count cached in Redis (`taitube:video:{id}:comments:top`) with 60s TTL for instant video watch page rendering.
   - Fastify singleflight promise coalescing on comment cache misses.
4. **Denormalized Comment Counter**:
   - `videos.comments_count` updated transactionally on comment creation/deletion.
5. **Moderation via Declarative Permissions (`@vp/permissions`) & Query Scoping**:
   - Enforce authorization strictly via `@vp/permissions` (`canCreateComment`, `canUpdateComment`, `canDeleteComment`, `canPinComment`) using `assertCan(...)` guards.
   - Author can edit (`PATCH`) and delete (`DELETE`) their comment.
   - Video creator can pin/unpin comments (`POST /v1/comments/:id/pin`) and moderate/delete any comment under their video.
   - Admin superuser bypass allows deleting any comment.
   - Repository queries use `drizzleWhere` with `notDeletedScope` to guarantee filtered active comments.
   - Zero manual hand-checking of `user.id === comment.authorId` in routes or services.

## Acceptance criteria

- [ ] Migration creating `video_comments`:
  - `id UUIDv7 PK, video_id UUID not null references videos.id on delete cascade, author_id UUID not null references users.id, parent_id UUID references video_comments.id on delete cascade, content text not null, is_pinned boolean not null default false, is_edited boolean not null default false, like_count integer not null default 0, created_at, updated_at`.
  - Composite indexes: `(video_id, parent_id, is_pinned DESC, like_count DESC, created_at DESC)` and `(video_id, parent_id, is_pinned DESC, created_at DESC)`.
- [ ] Add `comments_count integer not null default 0` to `videos` table.
- [ ] `CommentRepositoryPort` in `@taitube/core/repositories/comment-repository.port.ts`.
- [ ] `PostgresCommentRepository` in `adapters/postgres/repositories/postgres-comment-repository.ts` (<= 250 lines) composing queries via `drizzleWhere`.
- [ ] `InMemoryCommentRepository` in `adapters/in-memory/repositories/in-memory-comment-repository.ts`.
- [ ] Redis hot comments cache service (`adapters/redis/comment-cache.service.ts`).
- [ ] Endpoints:
  - `GET /v1/videos/:id/comments`: Returns top-level comments (with pinned comments first), author channel profile, and reply counts. Supports `sort=top|newest`, keyset cursor + fallback `page`/`size`.
  - `GET /v1/comments/:commentId/replies`: Returns threaded replies under a specific comment (keyset paginated).
  - `POST /v1/videos/:id/comments`: Adds a comment or reply (validates max 2000 chars, non-empty, checks `canCreateComment`), increments `videos.comments_count`, and purges hot comments cache.
  - `PATCH /v1/comments/:id`: Edits comment content (`is_edited = true`, guards with `assertCan(canUpdateComment({ user, comment }))`).
  - `DELETE /v1/comments/:id`: Deletes comment (guards with `assertCan(canDeleteComment({ user, comment, videoOwnerId }))`), decrements `videos.comments_count`, purges cache.
  - `POST /v1/comments/:id/pin`: Pins comment (guards with `assertCan(canPinComment({ user, videoOwnerId }))`; unpins existing pinned comment on video).
- [ ] Concurrency & route tests verifying threading, dual sorting, hot comments caching, and moderation guards.

## Out of scope

- Real-time SSE comment live stream (can be added as an extension).
- AI automated spam sentiment classification.

## Notes for the implementer

- **Sanitization:** Strip harmful HTML/script tags from content using basic text sanitization or validation.
- **Legacy pagination adapter:**
  ```ts
  const limit = query.size ? Number(query.size) : (query.limit ?? 20);
  const offset = query.page ? (Number(query.page) - 1) * limit : undefined;
  ```
- File length rule: Strictly <= 250 lines for postgres-comment-repository.ts.

## Testing plan

- Unit tests for repository methods (tree retrieval, pinned ordering).
- RBAC/ABAC tests: Author vs Video Creator vs Admin deletion rights.
- Route tests via app.inject() testing CRUD operations.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
