# 42: Threaded video comments with keyset pagination & moderation

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC |
| Blocks | 45, 76 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

The original frontend expected full comment interactions (GET /videos/:id/comments, POST /videos/:id/comments, PATCH /videos/:id/comments/:id, DELETE /videos/:id/comments/:id) but lacked hierarchical replies, pinned comments, author badges, and scalable keyset pagination.

This ticket delivers:
1. **Threaded / Hierarchical Comment Model**: Root comments (parent_id IS NULL) with 1-level reply nesting (parent_id = root_comment_id).
2. **Key properties**: content, edited indicator, pinned by creator indicator, likes count.
3. **Resilient Pagination**: High-performance keyset cursor (created_at, id) pagination, plus a backward-compatible adapter supporting the legacy frontend page and size query params.
4. **Moderation with RBAC/ABAC**:
   - Comment author can edit (PATCH) and delete (DELETE) their comment.
   - Video owner can pin/unpin comments (POST /v1/comments/:id/pin) and delete any comment under their video.
   - Admin can delete any comment.

## Acceptance criteria

- [ ] Migration creating video_comments:
  - id UUIDv7 PK, video_id UUID not null references videos.id on delete cascade, author_id UUID not null references users.id, parent_id UUID references video_comments.id on delete cascade, content text not null, is_pinned boolean not null default false, is_edited boolean not null default false, like_count integer not null default 0, created_at, updated_at.
  - Composite indexes: (video_id, parent_id, is_pinned DESC, created_at DESC) for efficient retrieval.
- [ ] CommentRepositoryPort in @vp/core/repositories/comment-repository.port.ts.
- [ ] PostgresCommentRepository in adapters/postgres/repositories/postgres-comment-repository.ts (<= 250 lines).
- [ ] InMemoryCommentRepository in adapters/in-memory/repositories/in-memory-comment-repository.ts.
- [ ] Endpoints:
  - GET /v1/videos/:id/comments: Returns top-level comments (with pinned comments first), author channel profile, and reply counts. Supports keyset cursor + fallback page/size.
  - GET /v1/comments/:commentId/replies: Returns threaded replies under a specific comment.
  - POST /v1/videos/:id/comments: Adds a comment or reply (validates max 2000 chars, non-empty).
  - PATCH /v1/comments/:id: Edits comment content (sets is_edited = true, checks author permission via ticket 39 engine).
  - DELETE /v1/comments/:id: Soft or hard deletes comment (verifies author, video owner, or admin).
  - POST /v1/comments/:id/pin: Pins comment (verifies video owner or admin; unpins existing pinned comment on video).
- [ ] Integration tests verifying threading, moderation rules, pagination cursor stability, and legacy page query param translation.

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
