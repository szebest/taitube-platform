# 37: Admin category management & public cached category API

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 04 — API skeleton + auth + schema |
| Blocks | 44, 45, 50, 61 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** ready

## What to build

The legacy frontend (`szebest/youtube-frontend`) hardcoded static numeric category IDs (`1` = Film, `2` = Animation, etc.), making taxonomy changes impossible without frontend rebuilds and preventing administrators from organizing content dynamically.

This ticket delivers:
1. **PostgreSQL dynamic categories table** (`categories`) with slug uniqueness, active toggle, and display ordering.
2. **Administrative category CRUD** (`POST /v1/admin/categories`, `PATCH /v1/admin/categories/:id`, `DELETE /v1/admin/categories/:id`) restricted to users with `role=admin` or tier permissions.
3. **High-performance public API** (`GET /v1/categories`) cached in Redis with HTTP conditional requests (`ETag` / `If-None-Match` returning `304 Not Modified`). Cache invalidation happens immediately upon any admin modification.
4. Clean port and repository abstractions following hexagonal architecture and file size limits (<= 250 lines).

## Acceptance criteria

- [ ] Database migration adding `categories` table (`id` UUIDv7, `slug` text unique, `name` text not null, `description` text, `icon_url` text, `sort_order` integer default 0, `is_active` boolean default true, `created_at`, `updated_at`).
- [ ] Foreign key relation / indexing prepared for video categorization (nullable `category_id` references `categories.id` on `videos`).
- [ ] `CategoryRepositoryPort` defined in `@vp/core/repositories/category-repository.port.ts` and domain entity in `@vp/core/domain/category.ts`.
- [ ] Modular PostgreSQL implementation in `adapters/postgres/repositories/postgres-category-repository.ts` (<= 250 lines).
- [ ] In-memory test double in `adapters/in-memory/repositories/in-memory-category-repository.ts` with `.clear()` encapsulation.
- [ ] `GET /v1/categories` public endpoint (no auth required):
  - Returns array of active categories sorted by `sort_order ASC, name ASC`.
  - Backed by Redis cache key `vp:cache:categories:v1`.
  - Sets HTTP `ETag` and `Cache-Control: public, max-age=300, stale-while-revalidate=60`.
  - Supports `If-None-Match` returning `304 Not Modified` with zero database round-trips.
- [ ] Admin endpoints (`POST /v1/admin/categories`, `PATCH /v1/admin/categories/:id`, `DELETE /v1/admin/categories/:id`):
  - Enforces `requireAuth` + admin verification (role or dev admin token).
  - Validates request body using Zod (`name`, `slug` format `^[a-z0-9-]+$`, `sortOrder`, `isActive`).
  - Automatically evicts Redis cache key `vp:cache:categories:v1` on any mutation.
- [ ] Route tests via `app.inject()`:
  - Anonymous `GET /v1/categories` returns 200 with categories and valid `ETag`.
  - Repeated `GET /v1/categories` with matching `If-None-Match` returns 304.
  - Non-admin callers get 403 on `/v1/admin/categories/*`.
  - Admin mutations invalidate the cache and subsequent GET returns fresh data with new `ETag`.
- [ ] OpenAPI 3.1 schema updated and registered for `/docs`.

## Out of scope

- Per-category video recommendation algorithms (covered in future recommendation tickets).
- Tagging taxonomies outside categories (covered in video metadata ticket 44).

## Notes for the implementer

- **Cache invalidation:**
  ```ts
  const CATEGORIES_CACHE_KEY = 'vp:cache:categories:v1';
  // On GET:
  const cached = await redis.get(CATEGORIES_CACHE_KEY);
  // On Admin mutations:
  await redis.del(CATEGORIES_CACHE_KEY);
  ```
- **ETag generation:** Compute fast MD5 or SHA-1 hash over the JSON serialized array.
- **Repository constraint:** Strictly maintain <= 250 lines per file. Never merge category repository with video or user repositories.
- **Errors:** Throw `PermanentError` with code `CATEGORY_NOT_FOUND`, `CATEGORY_SLUG_CONFLICT`, or `CATEGORY_IN_USE` when deleting a category with associated videos.

## Testing plan

- Unit tests: `PostgresCategoryRepository` and `InMemoryCategoryRepository` parity tests.
- Service tests: Cache hit, cache miss, and cache eviction upon creation/update/deletion.
- Route tests (`app.inject`): ETag 304 handling and admin authorization guards.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
