# 41: Channel subscriptions & subscribed channels video feed

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#41](https://github.com/szebest/taitube-platform/issues/41) |
| Size | M |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC |
| Blocks | 45, 78 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

## What to build

Channel subscriptions are central to YouTube. Viewers subscribe to channels they like and want to see a curated feed of new videos uploaded by those creators.

This ticket delivers:
1. **Durable Subscriptions Model & Atomic Upsert**:
   - `channel_subscriptions` table (`subscriber_id`, `channel_id`, `created_at`) with unique composite key `(subscriber_id, channel_id)`.
2. **Redis Subscription Caching**:
   - User subscription set cached in Redis (`taitube:user:{id}:subscriptions`) for O(1) `SISMEMBER` checks when opening a channel. A missing key is a miss, so an empty set is stored as a sentinel member rather than not at all.
   - Channel subscriber counter cached in Redis (`taitube:channel:{id}:subscriber_count`), written through from the count the Postgres transaction returns. The transaction is the source of truth; the cache never derives the count itself.
3. **Subscription Management Endpoints**:
   - `POST /v1/channels/:id/subscribers` (subscribe to channel) — idempotent, updates Redis set and DB transactionally.
   - `DELETE /v1/channels/:id/subscribers` (unsubscribe from channel).
   - `GET /v1/channels/:id/subscribers/me`: checks whether the authenticated caller is subscribed, answered from the Redis set; a miss primes the whole set from Postgres.
   - `GET /v1/me/subscriptions`: list channels the current user is subscribed to (with keyset pagination on `(created_at, channel_id)`).
4. **Subscription Feed API**:
   - `GET /v1/feed/subscriptions`: Keyset-paginated list of `READY` + `public` videos published by channels the user subscribes to, sorted newest first `(created_at DESC, id DESC)`.
   - Backed by indexed join on `(subscriber_id, channel_id)` -> `(owner_id, visibility, status)`.

5. **Shared keyset pagination** (`@vp/core/pagination`):
   - `Paginator` owns page bounds and cursor minting; repositories return `limit + 1` rows and never encode a cursor.
   - `CursorCodec` is swappable (`Base64UrlCursorCodec` by default, `JsonCursorCodec` for tests) and runtime-agnostic.
   - `PAGE_SIZE_DEFAULT` / `PAGE_SIZE_MAX` are resolved at app start and injectable per call site.
   - `VideoService` was migrated onto it in the same change, replacing its own copy of the same page maths.

## Acceptance criteria

- [x] Migration creating `channel_subscriptions`:
  - `id UUIDv7 PK, subscriber_id UUID not null references users.id, channel_id UUID not null references channels.id, created_at timestamptz not null`.
  - Unique constraint on `(subscriber_id, channel_id)`.
  - Composite indexes on `(subscriber_id, created_at DESC)` and `(channel_id, created_at DESC)`.
- [x] Self-subscription prevention: Returning 400 `CANNOT_SUBSCRIBE_TO_SELF` if `subscriber_id === channel.userId`.
- [x] `SubscriptionRepositoryPort` in `core/repositories/subscription-repository.port.ts`; paginating methods return `limit + 1` rows, not an encoded cursor.
- [x] `PostgresSubscriptionRepository` in `adapters/postgres/repositories/postgres-subscription-repository.ts` (<= 250 lines).
- [x] `InMemorySubscriptionRepository` with `.clear()`.
- [x] `RedisSubscriptionCacheAdapter` (`adapters/redis/redis-subscription-cache.adapter.ts`) and `InMemorySubscriptionCache` (`adapters/in-memory/in-memory-subscription-cache.ts`) as separate implementations of `SubscriptionCachePort` — the Redis adapter carries no in-memory fallback.
- [x] Atomic subscription flow:
  - Creates/deletes the subscription row and moves `channels.subscriber_count` in one PostgreSQL transaction.
  - Reports whether the call actually changed anything, so a repeat subscribe skips the redundant cache writes.
  - Synchronously updates the user's Redis subscription set (`SADD` / `SREM`).
- [x] `GET /v1/feed/subscriptions`:
  - Requires authentication.
  - Performs indexed join on `channel_subscriptions` -> `videos` (where `visibility = 'public'` and `status = 'READY'`).
  - Cursor pagination `(created_at, id)`.
- [x] `channel:subscribe` expressed as a CASL rule in `@vp/permissions` (`can('subscribe', 'Channel')` for any authenticated role) and asserted on both the subscribe and unsubscribe routes.
- [x] Integration tests verifying subscription lifecycle, count consistency, Redis cache synchronization, and feed isolation.

## Out of scope

- Push/Email notifications when new videos are published (future notification ticket).

## Implementation notes

- **Authorization is asserted, not fired and forgotten.** Routes call `request.assertCan('channel:subscribe')`, which throws synchronously. The `request.authorize(...)` decorator returns a promise; calling it without `await` swallows the rejection and lets the handler continue, so it must not be used as a guard.
- **Cursors are minted in the service, not the adapter.** Both subscription repositories return a `limit + 1` window of rows; `SubscriptionService` trims it and encodes the cursor through the shared `Paginator`. This matches `listByOwner`/`listPublic` and keeps the base64 wire format out of the persistence layer.
- **`GET /channels/:id/subscribers/me` primes the whole set on a miss.** One `getUserSubscriptionChannelIds` query answers the current call *and* seeds Redis, instead of a point lookup that leaves the cache cold for the next one.
- **`channels.user_id` is unique**, so the feed's `videos → channels → channel_subscriptions` join cannot fan out and `count(*)` over it is exact.

## Notes for the implementer

- Efficient subscription feed query:
  ```sql
  SELECT v.* FROM videos v
  INNER JOIN channels c ON v.owner_id = c.user_id
  INNER JOIN channel_subscriptions s ON s.channel_id = c.id
  WHERE s.subscriber_id = :currentUserId AND v.visibility = 'public' AND v.status = 'READY'
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT :limit;
  ```
- File discipline: Keep repository strictly under 250 lines.

## Testing plan

- Parity tests for Postgres & in-memory repositories.
- Concurrency test: Multiple subscribe/unsubscribe requests from same user resolve idempotently.
- Query test: Subscription feed excludes videos from unsubscribed channels and non-public videos.

## Definition of Done

- [x] All ACs green under pnpm test and bun test.
- [x] `pnpm typecheck` and `pnpm lint` introduce no new errors or warnings over the baseline.
- [x] `core` added to the `test:bun` scope, so the shared pagination module is covered under both runtimes.
- [x] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
