# 36: Public video feed — unauthenticated browse, detail, and SSE for public videos

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#36](https://github.com/szebest/taitube-platform/issues/36) |
| Size | M |
| Blocked by | 19 — Videos API completion · 15 — SSE progress events |
| Blocks | 49 |
| Spec | [PRD US-12](../PRD.md#53-status-feedback) · [PRD FR-14](../PRD.md#6-functional-requirements) · [SDD §6.1 API contract](../SDD.md#6-api-contract) · [SDD §11 Authorisation](../SDD.md#11-security) |

**Status:** ready

## What to build

A frontend developer building a public-facing video platform (think YouTube homepage, Vimeo explore) must be able to:

1. **List public videos without any token with multi-sort & category filters**:
   - `GET /v1/feed` returns a paginated list of all `visibility=public` + `status=READY` videos.
   - Supports `sort=trending` (time-decayed engagement gravity score), `sort=popular` (views count), and `sort=recent` (newest first).
   - Supports `categoryId` query parameter to filter feed by category.
2. **High-Performance Redis Feed Caching & Singleflight**:
   - First-page feed responses cached in Redis (`taitube:feed:public:{sort}:{categoryId}`) with 30s TTL + stale-while-revalidate.
   - Singleflight promise coalescing: 5,000 concurrent anonymous visitors hitting the homepage execute exactly 1 database query.
   - HTTP `ETag` and `Cache-Control: public, max-age=30, stale-while-revalidate=60` returning `304 Not Modified` on cache hits.
3. **Fetch a single public video without a token** — `GET /v1/videos/:id` handles this for `public` and `unlisted` videos.
4. **Subscribe to SSE for a public/unlisted video without a token** — `GET /v1/videos/:id/events` accepts anonymous connections when the video is `public` or `unlisted`.

The existing `GET /v1/videos` endpoint is **not changed** — it remains a "my videos" endpoint scoped to the authenticated caller.

## Acceptance criteria

- [ ] `GET /v1/feed` — no `Authorization` header needed:
  - Returns `{ items: VideoSummaryView[], nextCursor, total }` containing only `visibility=public` AND `status=READY` videos.
  - Supports `sort=recent` (default, keyset `(created_at, id)`), `sort=popular` (keyset `(views_count, id)`), and `sort=trending` (gravity ranking).
  - Supports `categoryId` UUID filter.
  - Sets `ETag` header and handles `If-None-Match` returning `304 Not Modified`.
  - First-page results cached in Redis with singleflight deduplication.
- [ ] `GET /v1/feed?limit=N` (1–100, default 20) and `GET /v1/feed?cursor=<opaque>` work correctly across sort modes.
- [ ] `GET /v1/feed` with an optional valid `Authorization: Bearer <token>` still works (feed is always global public).
- [ ] `GET /v1/videos/:id` with no token returns 200 for `visibility=public` and `visibility=unlisted`; returns 401 for `visibility=private`.
- [ ] `GET /v1/videos/:id/events` with no token returns the SSE stream for `public`/`unlisted` videos; returns 401 for `private` videos.
- [ ] `GET /v1/feed` is documented in `/docs` (OpenAPI 3.1) with full request/response schema, marked `security: []` (no auth required).
- [ ] `VideoService.listPublic(options)` added as a new method — does **not** modify the existing `list(user, options)` method.
- [ ] Route tests via `app.inject()`:
  - Anonymous `GET /v1/feed` returns 200 with videos, valid `ETag`, and `Cache-Control`.
  - Repeated `GET /v1/feed` with `If-None-Match` returns 304.
  - `GET /v1/feed?sort=popular` returns videos ordered by views descending.
  - Anonymous `GET /v1/videos/:id/events` on a public video returns 200; on private video returns 401.

## Out of scope

- Search, full-text filtering, tags (future ticket)
- Sorting options other than newest-first (future ticket)
- Rate limiting on `/v1/feed` (the existing global rate limiter from Fastify already applies)
- `unlisted` videos in the feed (unlisted = accessible by direct link only, not listed publicly)

## Notes for the implementer

**New `VideoService.listPublic` method** — mirrors `list()` but queries `visibility = 'public' AND status = 'READY'` across all owners, no `ownerId` filter. Keyset cursor is identical in format to `/v1/videos`.

**Route auth pattern** — the route must NOT call `requireAuth`. Instead, optionally read `request.user` (already populated by the `onRequest` auth hook when a valid token is present, `null` otherwise). The route handler ignores the user for scoping:

```ts
server.get('/v1/feed', { schema: { security: [] } }, async (request, reply) => {
  // request.user may be null — that's fine, feed is public
  const result = await videoService.listPublic(request.query);
  return reply.status(200).send(result);
});
```

**SSE auth fix** — in `apps/api/src/routes/events.ts`, the `GET /v1/videos/:id/events` handler currently calls `requireAuth` before checking visibility. Change the order: load the video first, then enforce auth only if `video.visibility === 'private'`. This mirrors the exact pattern in `VideoService.get()`.

**Do not change `GET /v1/videos`** — it stays auth-required and owner-scoped. The "my videos" and "public feed" are intentionally separate endpoints with different semantics.

**In-memory test double** — `InMemoryVideoRepository` needs a `listPublic` method (or the existing `listByOwner` can be extended with `ownerId: null` meaning "all owners" — pick the option cleaner in the in-memory impl and keep it consistent with the Postgres impl).

## Testing plan

- Unit: `VideoService.listPublic` with `InMemoryVideoRepository` seeded with a mix of visibilities and statuses — assert only `public+READY` rows returned, correct cursor pagination, correct `playbackUrl` construction.
- Route (inject): anonymous `GET /v1/feed` → 200; `GET /v1/feed?limit=2` → 2 items + cursor; follow cursor → next page.
- Route (inject): no-token `GET /v1/videos/:id` on public → 200; on private → 401.
- Route (inject): no-token `GET /v1/videos/:id/events` on public → 200 SSE stream; on private → 401.
- OpenAPI snapshot: assert `/v1/feed` present with `security: []`.

## Open questions

- Should `unlisted` videos appear in `/v1/feed`? **Decided: No.** Unlisted = shareable by direct link only, not discoverable. Only `public` videos appear in the feed.
- Should an authenticated user see their own non-READY public videos in `/v1/feed`? **Decided: No.** Feed is always `public + READY` regardless of caller identity, keeping the endpoint simple and cacheable.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero errors.
- [ ] OpenAPI at `/docs` shows `/v1/feed` with `security: []`.
- [ ] Ticket status set to `done` and `gen-index.py` re-run.
