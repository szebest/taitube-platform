# 46: YouTube-grade playlists & watch history domain engine (Public/private, Watch Later, drag-and-drop reorder & resume sync)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 38 — User & channel identity · 39 — Declarative RBAC & ABAC permission engine |
| Blocks | 47, 49, 73 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

YouTube engagement and viewer retention heavily rely on personal libraries: creating custom playlists, organizing watchlists, bookmarking videos with one click, and resuming playback where they left off across devices.

This ticket delivers the **YouTube-Grade Playlist & Watch History Domain Engine**:

1. **Flexible Playlist Domain Model**:
   - **`playlists` table:** `id UUIDv7 PK, owner_id UUID FK to users.id, title text, description text, visibility text ('public', 'unlisted', 'private'), is_system boolean default false, custom_thumbnail_key text, created_at, updated_at`.
   - **`playlist_items` table:** `id UUIDv7 PK, playlist_id UUID FK on delete cascade, video_id UUID FK on delete cascade, position integer not null, added_at timestamptz not null`. Unique constraint on `(playlist_id, video_id)`. Index on `(playlist_id, position)`.
   - **System "Watch Later" Playlist:** Upon first user authentication (or JIT channel creation), automatically provisions a persistent, private system playlist named `"Watch Later"` (`is_system = true`, `visibility = 'private'`). System playlists cannot be deleted by users.
   - **Privacy & Ownership Rules:**
     - `PUBLIC`: Readable by any user, indexed in search, visible on creator channel's Playlists tab.
     - `UNLISTED`: Readable by anyone with the playlist ID / direct share link, excluded from public search and channel tab.
     - `PRIVATE`: Readable and editable ONLY by the playlist owner (`user.id === playlist.owner_id`).
     - Only the playlist owner can add, reorder, or delete items.

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
   - **Redis Playhead Buffer (`vp:user:{id}:playhead:{videoId}`)**: High-frequency 5-second playback heartbeats buffer in Redis with 7-day TTL for instant `< 1ms` resume queries without hammering PostgreSQL with UPDATE statements on every playback ping.
   - **Write-Behind Flush**: Playhead positions periodically flushed to `watch_history` table upon video completion, pause, or session end. If `progress_seconds >= duration_seconds * 0.92`, automatically marks video as completed.
   - `POST /v1/me/history`: Atomic upsert saving playback progress.
   - `GET /v1/me/history`: Keyset-paginated watch history ordered by `watched_at DESC` with video details, creator channel info, and progress percentage.
   - `DELETE /v1/me/history`: Clears entire history.
   - `DELETE /v1/me/history/:videoId`: Removes an individual video from watch history.

5. **Hexagonal Architecture & File Sizing**:
   - `PlaylistRepositoryPort` and `WatchHistoryRepositoryPort` defined in `@vp/core/repositories/`.
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

## Definition of Done

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [ ] Architectural docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
