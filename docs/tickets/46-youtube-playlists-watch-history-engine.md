# 46: YouTube-grade playlists & watch history domain engine (Public/private, Watch Later, drag-and-drop reorder & resume sync)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#46](https://github.com/szebest/taitube-platform/issues/46) |
| Size | L |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC permission engine |
| Blocks | 47, 73 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** in-progress

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

YouTube engagement and viewer retention heavily rely on personal libraries: creating custom playlists, organizing watchlists, bookmarking videos with one click, and resuming playback where they left off across devices.

This ticket delivers the **YouTube-Grade Playlist & Watch History Domain Engine**:

1. **Flexible Playlist Domain Model**:
   - **`playlists` table:** `id UUIDv7 PK, owner_id UUID FK to users.id, title text, description text, visibility text ('public', 'unlisted', 'private'), is_system boolean default false, custom_thumbnail_key text, created_at, updated_at`.
   - **`playlist_items` table:** `id UUIDv7 PK, playlist_id UUID FK on delete cascade, video_id UUID FK on delete cascade, position integer not null, added_at timestamptz not null`. Unique constraint on `(playlist_id, video_id)`. Index on `(playlist_id, position)`.
   - **System "Watch Later" Playlist:** Upon first user authentication (or JIT channel creation), automatically provisions a persistent, private system playlist named `"Watch Later"` (`is_system = true`, `visibility = 'private'`). System playlists cannot be deleted by users.
   - **Privacy & Ownership Enforced via `@vp/permissions` & `drizzleWhere`:**
     - Evaluated declaratively via `@vp/permissions` (`canReadPlaylist`, `canUpdatePlaylist`, `canDeletePlaylist`, `canManagePlaylistItems`) and guarded by `assertCan(...)`.
     - `PUBLIC`: Readable by any user, indexed in search, visible on creator channel's Playlists tab.
     - `UNLISTED`: Readable by anyone with the playlist ID / direct share link, excluded from public search and channel tab.
     - `PRIVATE`: Readable and editable ONLY by the playlist owner; enforced at the SQL level via `drizzleWhere(playlistReadScope(user))`.
     - Only the playlist owner can add, reorder, or delete items. Zero manual hand-checking of user IDs in route handlers or domain services.

2. **Drag-and-Drop Item Reordering**:
   - Atomic reordering endpoint `PUT /v1/playlists/:id/reorder` supporting both:
     - Single item move: `{ itemId: UUID, newPosition: integer }` (shifts adjacent positions in a single transaction).
     - Full array re-indexing: `{ itemIds: UUID[] }` assigning sequential 0-indexed positions.

3. **Fast "Save to Playlist" Modal Query**:
   - Endpoint `GET /v1/me/playlists?videoId=:videoId`:
     - Returns all playlists owned by the authenticated user with a computed boolean flag `containsVideo: true/false`.
     - Powers the frontend "Save to Playlist" modal in a single round-trip without requiring client-side item fan-out.

4. **High-Scale Watch History & Resumable Playhead Engine**:
   - **`watch_history` table:** `id UUIDv7 PK, user_id UUID FK on delete cascade, video_id UUID FK on delete cascade, progress_seconds integer not null, duration_seconds integer not null, watched_at timestamptz not null`. Unique on `(user_id, video_id)`.
   - **Redis Playhead Buffer (`taitube:user:{id}:playhead:{videoId}`)**: High-frequency 5-second playback heartbeats buffer in Redis with 7-day TTL for instant `< 1ms` resume queries without hammering PostgreSQL with UPDATE statements on every playback ping.
   - **Write-Behind Flush**: Playhead positions periodically flushed to `watch_history` table upon video completion, pause, or session end. If `progress_seconds >= duration_seconds * 0.92`, automatically marks video as completed.
   - `POST /v1/me/history`: Atomic upsert saving playback progress.
   - `GET /v1/me/history`: Keyset-paginated watch history ordered by `watched_at DESC` with video details, creator channel info, and progress percentage.
   - `DELETE /v1/me/history`: Clears entire history.
   - `DELETE /v1/me/history/:videoId`: Removes an individual video from watch history.

5. **Hexagonal Architecture & File Sizing**:
   - `PlaylistRepositoryPort` and `WatchHistoryRepositoryPort` defined in `@taitube/core/repositories/`.
   - Modular Postgres repositories in `adapters/postgres/repositories/` (each <= 250 lines).
   - In-memory test doubles with `.clear()`.

## Acceptance criteria

- [ ] Database migration:
  - `playlists` table with `is_system boolean not null default false`, `visibility` enum/text check, and indexes on `(owner_id, visibility)`.
  - `playlist_items` table with unique constraint on `(playlist_id, video_id)` and index on `(playlist_id, position)`.
  - `watch_history` table with unique constraint on `(user_id, video_id)` and index on `(user_id, watched_at desc)`.
- [ ] JIT provisioner / service creates default "Watch Later" system playlist for user upon registration.
- [ ] Redis playhead caching service in `adapters/redis/playhead-cache.service.ts`.
- [ ] Playlist API Endpoints:
  - `POST /v1/playlists`: Creates custom playlist with title, description, and visibility (`public`, `unlisted`, `private`).
  - `GET /v1/playlists/:id`: Returns playlist metadata, owner channel profile, total video count, and ordered video items. Enforces privacy rules (404/403 for private playlist accessed by non-owner).
  - `PATCH /v1/playlists/:id`: Updates title, description, and visibility.
  - `DELETE /v1/playlists/:id`: Deletes playlist; returns 400 SYSTEM_PLAYLIST_IMMUTABLE if `is_system = true`.
  - `POST /v1/playlists/:id/items`: Appends video to end of playlist (`position = max(position) + 1`).
  - `DELETE /v1/playlists/:id/items/:videoId`: Removes video and shifts subsequent positions down.
  - `PUT /v1/playlists/:id/reorder`: Atomically reorders items via transaction.
  - `GET /v1/me/playlists?videoId=:videoId`: Returns user playlists with `containsVideo: boolean`.
- [ ] Watch History Endpoints:
  - `POST /v1/me/history`: Upserts playback position with `ON CONFLICT (user_id, video_id) DO UPDATE`.
  - `GET /v1/me/history`: Returns keyset-paginated list of watched videos ordered by `watched_at desc`.
  - `DELETE /v1/me/history`: Clears history for authenticated user.
  - `DELETE /v1/me/history/:videoId`: Deletes single video entry from history.
- [ ] RBAC enforcement:
  - Unauthenticated requests can only view `public` and `unlisted` playlists.
  - Modifying playlist items or deleting playlist requires owner identity or ADMIN role.
- [ ] Route tests via `app.inject()` validating CRUD, reordering consistency, privacy enforcement, and history synchronization.

## Out of scope

- Collaborative playlists with multiple concurrent editors.
- Smart algorithmic playlists (e.g. "Mixes" / automated radio).

## Notes for the implementer

- **Position Management:** On item addition, execute `COALESCE(MAX(position), -1) + 1` inside the insert transaction.
- **File Length Discipline:** Strictly keep `postgres-playlist-repository.ts` and `postgres-watch-history-repository.ts` under 250 lines each.

## Testing plan

- Unit tests for position calculation and privacy policy evaluator.
- Integration tests: create playlist -> add 5 videos -> reorder item 4 to position 1 -> assert sequence is exactly [4, 0, 1, 2, 3].
- Privacy test: User A creates private playlist; assert User B receives 404 NOT_FOUND.
- History test: Sync video progress at 45s; fetch history; assert `progress_seconds: 45`.

## Open questions

- Decided: sparse integer positions, 1024 apart, instead of dense `0..n-1`. A drag-and-drop move takes
  the midpoint between its new neighbours and rewrites that one row; the playlist is respaced (one
  `UPDATE ... FROM (VALUES ...)`) only when two neighbours sit adjacent or a key would leave the integer
  range. Append is `COALESCE(MAX(position) + 1024, 0)` inside the locked transaction, and removing an item
  deletes one row. The wire `position` is the 0-based place, so "removes video and shifts subsequent
  positions down" holds for every client without rewriting rows. The pure planner is
  `packages/universal/domain/src/playlist-position.ts`.
- Decided: the testing plan's "reorder item 4 to position 1 -> [4, 0, 1, 2, 3]" is really position 0.
  Both are tested: to 0 gives `[4, 0, 1, 2, 3]`, to 1 gives `[0, 4, 1, 2, 3]`.
- Decided: a full reindex must name every item exactly once. Anything else was drawn from a stale view
  and answers `409 VERSION_CONFLICT` rather than dropping or duplicating an item. The rule
  (`decidePlaylistReorder`) runs inside the repository transaction, against the items it has locked.
- Decided: packages stay `@vp/*` (ticket 48), so the ports are `core/repositories/playlist-repository.ts`
  and `watch-history-repository.ts` and the Redis adapter is `redis/redis-playhead-cache.adapter.ts`.
  `assertCan(...)` is `authorize(...)` from `@vp/domain-rules`, its `Result` form.
- Decided: Watch Later is provisioned with the channel in `ensureProvisioned` (idempotent through a
  partial unique index on `owner_id WHERE is_system`), and the migration backfills one for every user
  that already exists. The backfilled ids are `gen_random_uuid()`, since Postgres before 18 has no
  `uuidv7()`. Watch Later cannot be renamed either: `PATCH` answers `SYSTEM_PLAYLIST_IMMUTABLE` like
  `DELETE`.
- Decided: a playlist the caller cannot read answers `404 PLAYLIST_NOT_FOUND` for reads and writes alike;
  one they can read but not edit answers `403`. Items whose video the viewer may not watch are hidden
  and keep their place.
- Decided: `POST /v1/me/history` takes a `reason` (`heartbeat`, `pause` by default, `ended`). A heartbeat
  only writes the Redis buffer once the session has a row; the first beat, a pause and the end write
  through. There is no periodic flush job: every pause and end already writes through, and with Redis
  down every beat does. `GET /v1/me/history/:videoId` is the resume read the buffer exists for.
- Decided: an older playhead never overwrites a newer one (`ON CONFLICT ... WHERE watched_at <=
  excluded.watched_at`), so a late flush from a stale tab cannot rewind the history.
- Decided: `CacheClient.del` takes several keys, so clearing a history drops every buffered playhead in
  one round trip.
- Decided: `GET /v1/playlists/:id` returns every item unpaginated. YouTube caps a playlist at 5000 videos;
  a cap and paging are left to the frontend ticket (73) if a real playlist needs them.

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [ ] Architectural docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
