# 41: Channel subscriptions & subscribed channels video feed

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC |
| Blocks | 45, 78 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

Channel subscriptions are central to YouTube. Viewers subscribe to channels they like and want to see a curated feed of new videos uploaded by those creators.

This ticket delivers:
1. **Durable Subscriptions Model & Atomic Upsert**:
   - `channel_subscriptions` table (`subscriber_id`, `channel_id`, `created_at`) with unique composite key `(subscriber_id, channel_id)`.
2. **High-Performance Redis Subscription Caching**:
   - User subscription set cached in Redis (`taitube:user:{id}:subscriptions`) for instant O(1) `< 0.1ms` `SISMEMBER` checks when opening channels.
   - Channel subscriber counter cached in Redis (`taitube:channel:{id}:subscriber_count`) with atomic increment/decrement (`INCRBY` / `DECRBY`).
3. **Subscription Management Endpoints**:
   - `POST /v1/channels/:id/subscribers` (subscribe to channel) — idempotent, updates Redis set and DB transactionally.
   - `DELETE /v1/channels/:id/subscribers` (unsubscribe from channel).
   - `GET /v1/channels/:id/subscribers/me`: checks if current authenticated caller is subscribed (served in < 0.2ms via Redis set).
   - `GET /v1/me/subscriptions`: list channels the current user is subscribed to (with keyset pagination on `(created_at, channel_id)`).
4. **High-Scale Subscription Feed API**:
   - `GET /v1/feed/subscriptions`: Keyset-paginated list of `READY` + `public` videos published by channels the user subscribes to, sorted newest first `(created_at DESC, id DESC)`.
   - Backed by indexed join on `(subscriber_id, channel_id)` -> `(owner_id, visibility, status)`.

## Acceptance criteria

- [ ] Migration creating `channel_subscriptions`:
  - `id UUIDv7 PK, subscriber_id UUID not null references users.id, channel_id UUID not null references channels.id, created_at timestamptz not null`.
  - Unique constraint on `(subscriber_id, channel_id)`.
  - Composite indexes on `(subscriber_id, created_at DESC)` and `(channel_id, created_at DESC)`.
- [ ] Self-subscription prevention: Returning 400 `CANNOT_SUBSCRIBE_TO_SELF` if `subscriber_id === channel.userId`.
- [ ] `SubscriptionRepositoryPort` in `@taitube/core/repositories/subscription-repository.port.ts`.
- [ ] `PostgresSubscriptionRepository` in `adapters/postgres/repositories/postgres-subscription-repository.ts` (<= 250 lines).
- [ ] `InMemorySubscriptionRepository` with `.clear()`.
- [ ] Redis subscription set caching service (`adapters/redis/subscription-cache.service.ts`).
- [ ] Atomic subscription flow:
  - Creates/deletes subscription record in PostgreSQL.
  - Updates `channels.subscriber_count` counter.
  - Synchronously updates user's Redis subscription set (`SADD` / `SREM`).
- [ ] `GET /v1/feed/subscriptions`:
  - Requires authentication.
  - Performs indexed join on `channel_subscriptions` -> `videos` (where `visibility = 'public'` and `status = 'READY'`).
  - Cursor pagination `(created_at, id)`.
- [ ] Integration tests verifying subscription lifecycle, count consistency, Redis cache synchronization, and feed isolation.

## Out of scope

- Push/Email notifications when new videos are published (future notification ticket).

## Notes for the implementer

- Efficient subscription feed query:
  `sql
  SELECT v.* FROM videos v
  INNER JOIN channels c ON v.owner_id = c.user_id
  INNER JOIN channel_subscriptions s ON s.channel_id = c.id
  WHERE s.subscriber_id = :currentUserId AND v.visibility = 'public' AND v.status = 'READY'
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT :limit;
  `
- File discipline: Keep repository strictly under 250 lines.

## Testing plan

- Parity tests for Postgres & in-memory repositories.
- Concurrency test: Multiple subscribe/unsubscribe requests from same user resolve idempotently.
- Query test: Subscription feed excludes videos from unsubscribed channels and non-public videos.

## Definition of Done

- [ ] All ACs green under pnpm test and bun test.
- [ ] pnpm typecheck && pnpm lint pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
