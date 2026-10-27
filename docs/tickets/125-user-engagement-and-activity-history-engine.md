# 125: User engagement & activity history engine — search, watch time, reactions, comments & unified activity log

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | XL (delivered as three slices, see *Delivery*) |
| Blocked by | 38 - User identity · 40 - High-throughput video reactions · 42 - Threaded comments · 46 - Watch history engine · 65 - Playback telemetry & QoS · 73 - Watch history feed · 97 - Account preferences · 98 - Realtime user event stream |
| Blocks | 126, 128 |
| Spec | [SDD §3.4 Status reporting](../SDD.md#34-status-reporting) · [SDD §5.1 Entity relationship](../SDD.md#51-entity-relationship) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** (written by Gemini, let Claude verify)
> YouTube's "Google My Activity" and watch history systems are notoriously opaque and siloed: search history is separated from watch history, playhead progress is unhelpfully approximated, and users cannot audit or inspect their cross-cutting engagement (likes, comments, searches, watch time duration, milestones) in one unified timeline.
> In our current platform, [46](46-youtube-playlists-watch-history-engine.md) stores an overwriting `(user_id, video_id)` playhead tuple, [65](65-first-party-video-playback-telemetry-analytics-beacon.md) collects video QoS beacons into aggregated milestone counters, but searches leave zero persistent user trail and cumulative user watch-time sessions are never compiled into personal activity profiles.
> This ticket builds a unified, privacy-first, high-throughput user activity engine:
> 1. Complete search history with query frequency, contextual filters, click-through attribution, and instantaneous deletion/pause controls.
> 2. High-resolution session watch logs: rather than only updating the latest playhead position in-place, periodic playback progress heartbeats append to an append-only rolling session log (`user_watch_sessions`), recording precise watch durations, repeat watches, and interval segments.
> 3. Unified Activity Hub API: aggregate searches, video views, comments, comment hearts, playlist saves, and reactions into a unified, keyset-paginated, multi-type event timeline with date-bucketed groups and full-text filterability.
> 4. Full privacy & GDPR export compliance: instant one-click purge by type, date range, or individual entry; auto-expiration retention schedules; and strict pausing honored by both DB and Redis buffers.

## What to build (written by Gemini, let Claude verify)

### 1. Data Model & Migrations (`@vp/db`)
- **Table `search_history`**:
  - `id` (UUIDv7), `user_id` (UUID, FK -> `users.id` cascade), `query` (text, trimmed, lowercase normalized for deduplication), `filters` (jsonb, e.g. `{ duration, uploadDate, sort }`), `result_count` (int), `clicked_video_id` (UUID nullable, FK -> `videos.id`), `created_at` (timestamptz).
  - Indexes: `(user_id, created_at desc, id desc)`, GIN index on `query gin_trgm_ops` for fast prefix/fuzzy search within personal history, and `(user_id, query)`.
- **Table `user_watch_sessions`** (high-resolution session history):
  - `id` (UUIDv7), `user_id` (UUID), `video_id` (UUID), `session_uuid` (UUID), `started_at` (timestamptz), `ended_at` (timestamptz), `watch_duration_seconds` (int, cumulative played time, not just position difference), `max_progress_seconds` (int), `completion_ratio` (numeric(4,3)), `device_type` (text: `desktop | mobile | tablet | bot`).
  - Indexes: `(user_id, started_at desc)`, `(video_id, started_at desc)`.
- **View / Materialized projection `unified_user_activity`**:
  - A unified union query over:
    - `watch`: video title, channel title, duration, watched seconds, progress percentage.
    - `search`: search query string, filters, clicked result title.
    - `reaction`: video title, reaction type (`like` | `dislike`), reacted at.
    - `comment`: comment body excerpt, video title, is_reply, created at.
    - `comment_heart`: comment body, creator handle, hearted at.

### 2. High-Throughput Ingestion & Redis Session Buffer (`@vp/adapters`)
- **Real-Time Heartbeat Stream**:
  - While playing, player sends a throttled heartbeat beacon every 10 seconds to `POST /v1/me/history/heartbeat`.
  - Stored in Redis via Lua script: `HINCRBY user:watch:<userId>:<sessionId> watch_seconds 10` and `HSET ... max_position <pos>`.
  - Flushed in background batches every 30 seconds by worker housekeeping task (`flush-user-watch-sessions`), updating `watch_history` (playhead for resume) and appending/merging the row in `user_watch_sessions` in a single bulk operation.
- **Privacy & Pause Gate**:
  - Respects [97](97-account-preferences-api.md)'s `historyPaused` setting at both Fastify edge and Redis worker flush: if paused, incoming heartbeats and search logs immediately return 204 with zero writes.

### 3. API Contract & Endpoints (`@vp/api-contracts` & `apps/server/api`)
- **Search History**:
  - `GET /v1/me/history/searches`: keyset paginated, filter by `q` prefix or date range (`since`, `until`).
  - `DELETE /v1/me/history/searches/:id`: remove a single query.
  - `DELETE /v1/me/history/searches`: clear all search history, or clear by query prefix / date range.
  - `PATCH /v1/me/history/searches/:id/click`: attribute a clicked video to the search query for relevance feedback.
- **Watch Time & Analytics**:
  - `GET /v1/me/history/stats`: returns total watch time today, this week, daily averages, most watched categories, and top channels.
- **Unified Activity Feed**:
  - `GET /v1/me/activity`: multi-type activity feed (`type=all|watch|search|reaction|comment`), grouped by day, keyset paginated with cursor encoding timestamp and UUID.
  - `DELETE /v1/me/activity`: bulk deletion by type or time boundary (`today`, `yesterday`, `all_time`).

### 4. Web UI & "My Activity" Hub (`apps/client/web`)
- Add page `/feed/history/activity` with sub-navigation:
  - **Watch History**: Detailed list with thumbnail, channel badge, progress bar, watch count badge ("Watched 3 times"), and resume button.
  - **Search History**: Timeline of search chips with instant delete (`X`), re-execute button, and query volume stats.
  - **Interactions**: Tabbed view of user's comments, likes, and saved clips with direct deep-links.
  - **Stats & Insights Shelf**: Visual stat cards ("Watch time: 1h 45m today", "Top topic: TypeScript").
  - Search within history input field: instantaneous fuzzy filter over loaded activities using `@vp/ui` search input.

## Acceptance criteria (written by Gemini, let Claude verify)

- [ ] New tables `search_history` and `user_watch_sessions` deployed via Drizzle migration with complete indices. (written by Gemini, let Claude verify)
- [ ] Every user search dispatched via search bar logs an entry to `search_history` with query string, active filters, and result count; clicking a video updates `clicked_video_id`. (written by Gemini, let Claude verify)
- [ ] Player dispatches regular watch heartbeats; Redis session buffer aggregates elapsed seconds and flushes to `user_watch_sessions` with zero lost seconds on clean playback. (written by Gemini, let Claude verify)
- [ ] `GET /v1/me/activity` supports keyset pagination and filters by event kind (`watch`, `search`, `reaction`, `comment`). (written by Gemini, let Claude verify)
- [ ] Individual item deletion and bulk clear by range execute in under 50ms with 100% cascade cleanup across tables. (written by Gemini, let Claude verify)
- [ ] If `historyPaused` is set to `true` in user preferences, neither watch progress, session duration, nor search queries are written to Redis or Postgres. (written by Gemini, let Claude verify)
- [ ] Web app renders unified Activity hub (`/feed/history/activity`) with responsive tabs, date grouping, and instant deletion micro-interactions. (written by Gemini, let Claude verify)
- [ ] All repository implementations have dedicated 1:1 test files and pass dual contract tests for in-memory and PostgreSQL. (written by Gemini, let Claude verify)
