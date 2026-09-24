# 40: High-throughput video reactions (likes/dislikes) & counter caching

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#40](https://github.com/szebest/taitube-platform/issues/40) |
| Size | M |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC |
| Blocks | 45, 76 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

## What to build

The frontend allows viewers to like and dislike videos (POST /videos/:id/like, DELETE /videos/:id/like). In a viral video scenario, naive transactional DB updates on every reaction lock table rows and destroy database write throughput.

This ticket delivers:
1. **Durable Storage & Atomic Upsert**:
   - PostgreSQL `video_reactions` table (`user_id`, `video_id`, `reaction_type`: `LIKE` / `DISLIKE`, `created_at`, `updated_at`) with unique composite key `(user_id, video_id)`.
   - Atomic PostgreSQL upsert pattern updating state without race conditions.
2. **High-Performance Multi-Tier Redis Counter Cache**:
   - Redis hash `taitube:video:{id}:reactions` (`likes`, `dislikes`) for sub-millisecond retrieval.
   - User reaction lookup cached in Redis set/hash (`taitube:user:{userId}:reactions`) to eliminate DB hits on video page load.
3. **Cache Stampede Protection (Singleflight & Probabilistic Early Expiration)**:
   - Singleflight promise coalescing in Fastify: if 1,000 concurrent requests miss the reaction cache for a newly published or viral video, exactly 1 query executes against Postgres while all 999 callers await the coalesced result.
   - XFetch / Probabilistic background refresh for hot video counters.
4. **Periodic Drift Reconciler (BullMQ Worker)**:
   - Scheduled background job running hourly/daily verifying that cached counters match ground-truth `COUNT(*)` from `video_reactions`, repairing any drift automatically.
5. **Atomic API Mutations**:
   - `PUT /v1/videos/:id/reactions` (payload `{ type: 'LIKE' | 'DISLIKE' | 'NONE' }`): Idempotent upsert. Atomically transitions between states (e.g. from dislike to like or clearing reaction) and adjusts counters cleanly in Redis and Postgres.
   - `GET /v1/videos/:id/reactions/me`: Returns current authenticated caller reaction state (`{ reaction: 'LIKE' | 'DISLIKE' | null }`).

## Acceptance criteria

- [x] Database migration creating `video_reactions`:
  - `id UUIDv7 PK, video_id UUID FK not null, user_id UUID FK not null, type text (LIKE, DISLIKE) not null, created_at, updated_at`.
  - Unique constraint on `(user_id, video_id)`.
  - Index on `(video_id, type)`.
- [x] `VideoReactionRepositoryPort` in `@taitube/core/repositories/video-reaction-repository.port.ts`.
- [x] Modular `PostgresVideoReactionRepository` in `adapters/postgres/repositories/postgres-video-reaction-repository.ts` (<= 250 lines).
- [x] In-memory implementation `InMemoryVideoReactionRepository` with `.clear()`.
- [x] Redis reaction cache adapter with singleflight deduplication (`adapters/redis/redis-reaction-cache.adapter.ts`).
- [x] Route implementations:
  - `PUT /v1/videos/:id/reactions` (auth required): records reaction, adjusts counters atomically in Redis and Postgres.
  - `GET /v1/videos/:id/reactions/me`: returns authenticated caller reaction.
  - Video response in `GET /v1/videos/:id` enriched with `likesCount` and `dislikesCount`.
- [x] Scheduled reconciler job `reconcile-reaction-counters`:
  - Compares Redis/denormalized counters with actual count from `video_reactions` for active videos.
- [x] Concurrency & stampede tests:
  - 100 simultaneous concurrent requests on an uncached video trigger only 1 Postgres query.
  - 50 simultaneous reaction toggles from different users update the counters accurately without drift or deadlocks.

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

- [x] All ACs green under pnpm test and bun test.
- [x] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [x] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
