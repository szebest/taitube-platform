# 40: High-throughput video reactions (likes/dislikes) & counter caching

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC |
| Blocks | 45, 76 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

The frontend allows viewers to like and dislike videos (POST /videos/:id/like, DELETE /videos/:id/like). In a viral video scenario, naive transactional DB updates on every reaction lock table rows and destroy database write throughput.

This ticket delivers:
1. **Durable storage**: PostgreSQL video_reactions table (user_id, video_id, 
eaction_type: like / dislike, created_at) with unique composite key (user_id, video_id).
2. **High-performance Redis cache & counters**:
   - Redis hash or string counters caching likes_count and dislikes_count for instant retrieval with video detail queries.
   - User reaction lookup cached in Redis set/hash to avoid DB queries on video page load.
3. **Atomic API mutations**:
   - `PUT /v1/videos/:id/reactions` (payload `{ type: 'LIKE' | 'DISLIKE' | 'NONE' }`): Idempotent upsert. Atomically transitions between states (e.g. from dislike to like or clearing reaction) and adjusts counters cleanly in Redis and Postgres.
   - `GET /v1/videos/:id/reactions/me`: Returns current authenticated caller reaction state (`{ reaction: 'LIKE' | 'DISLIKE' | null }`).
4. Clean, standard RESTful design with zero legacy shims.

## Acceptance criteria

- [ ] Database migration creating `video_reactions`:
  - `id UUIDv7 PK, video_id UUID FK not null, user_id UUID FK not null, type text (LIKE, DISLIKE) not null, created_at, updated_at`.
  - Unique constraint on `(user_id, video_id)`.
  - Index on `(video_id, type)`.
- [ ] `VideoReactionRepositoryPort` in `@vp/core/repositories/video-reaction-repository.port.ts`.
- [ ] Modular `PostgresVideoReactionRepository` in `adapters/postgres/repositories/postgres-video-reaction-repository.ts` (<= 250 lines).
- [ ] In-memory implementation `InMemoryVideoReactionRepository` with `.clear()`.
- [ ] Redis caching service for reaction counts (`vp:video:{id}:reactions` hash with `likes` and `dislikes`).
- [ ] Route implementations:
  - `PUT /v1/videos/:id/reactions` (auth required): records reaction, adjusts counters atomically.
  - `GET /v1/videos/:id/reactions/me`: returns authenticated caller reaction.
  - Video response in `GET /v1/videos/:id` enriched with `likesCount` and `dislikesCount`.
- [ ] Concurrency test: 50 simultaneous reaction toggles from different users update the counters accurately without drift or deadlocks.

## Out of scope

- Comment reactions (handled in comments ticket 42).

## Notes for the implementer

- **Atomic upsert pattern in Postgres:**
  `sql
  INSERT INTO video_reactions (id, video_id, user_id, type, updated_at)
  VALUES (, , , , NOW())
  ON CONFLICT (user_id, video_id)
  DO UPDATE SET type = EXCLUDED.type, updated_at = NOW();
  `
- Keep repository implementation strictly within 250 lines.

## Testing plan

- Parity tests between PostgreSQL and In-memory repositories.
- Idempotency tests: Repeatedly liking the same video does not double increment.
- Switching tests: Liking a previously disliked video swaps counts correctly.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
