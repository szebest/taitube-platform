# 125: Viewer activity - search history, liked videos and my comments

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M |
| Blocked by | 40 - Video reactions · 42 - Threaded comments · 46 - Playlists and watch history · 47 - Multi-resource search · 97 - Saved preferences |
| Blocks | 73, 74, 126 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §9.8 Housekeeping](../SDD.md#98-housekeeping-job-schedulers) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** in-progress

> **Why.** A viewer's own trail is incomplete. [46](46-youtube-playlists-watch-history-engine.md) keeps watch history and the
> `historyPaused` switch ([97](97-account-preferences-api.md)), and [73](73-frontend-youtube-playlists-library-player-queue.md)
> builds its page, but a search leaves no per-user trace (47 records only an anonymous, shared suggestion index in Redis),
> there is no list of the videos a viewer liked (`video_reactions` has no list read), and no list of their own comments
> (`video_comments` has no author index). [126](126-recommendation-feedback-and-new-shelves.md) needs the search trail for a
> "Because you searched" shelf.

> **What this ticket does not build, and why.** The first draft of this ticket was a unified activity engine; most of it
> was already built, already owned, or not worth its cost:
>
> - `POST /v1/me/history/heartbeat`, a 30-second Redis flush job and the pause gate at the edge exist: `POST /v1/me/history`
>   takes `reason` (`heartbeat`, `pause`, `ended`), 46's write-behind buffer flushes at most once a minute and
>   `WatchHistoryService` skips the row while `privacy.historyPaused` is set.
> - An append-only `user_watch_sessions` log, per-user watch time and top channels: the only reader would be a stats card,
>   and 65's playback beacon is anonymous by design, so a per-user watch-time stream would be a new per-viewer record with no
>   feature behind it. Cut; see *Out of scope*.
> - One `UNION ALL` activity timeline with `DELETE /v1/me/activity`: four typed lists, each keyset-paged by its owner and
>   shown as tabs by 73, cost less than a heterogeneous union and keep every delete where it already lives (46's history
>   clear, 40's unlike, 42's comment delete).
> - Click-through attribution on searches (`PATCH .../click`) and `result_count`: nothing reads them. Cut.

## What to build

### 1. Search history

- Table `search_history` in `@vp/db` (own file `search-history-schema.ts`): `id` (UUIDv7), `user_id` (FK to `users`,
  cascade), `query_key` (the text trimmed, whitespace collapsed, lower-cased), `query` (the text as last typed),
  `searched_at`; unique `(user_id, query_key)` and index `(user_id, searched_at desc, id desc)`. One row per distinct query,
  so repeating a search moves it to the top instead of adding a row.
- Port `SearchHistoryRepositoryPort` in `@vp/core/repositories` with a postgres and an in-memory implementation, each in its
  own file (Rule 5), under one shared contract spec. `record` upserts the row and, in the same statement, deletes the user's
  rows beyond the newest 100; `list` is keyset on `(searched_at, id)`; `remove` and `clear` are keyed by the caller's id, so
  another user's row is never reachable.
- Recording happens in `SearchService.search`, after the query validated and for a signed-in caller on the first page only
  (no `cursor`), so the Redis page cache, which serves every viewer, is untouched and a cache hit records too. The call is
  awaited and its failure ignored: search never fails because of its history. Anonymous calls record nothing. Filters
  (`type`, `sort`, `categoryId`) are not stored.
- The pause rule has one owner. `WatchHistoryService`'s private `historyPaused` read moves to a small `HistoryPause` in
  `apps/server/api/src/services/` that both services take; while `privacy.historyPaused` is set, `record` writes nothing.
  One switch pauses watch and search history (a product call, see *Open questions*).
- Housekeeping ([SDD §9.8](../SDD.md#98-housekeeping-job-schedulers)): a daily `purge-search-history` task deletes rows older
  than 90 days.
- Endpoints, in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1, all signed-in:
  - `GET /v1/me/searches` (`cursor`, `limit`): `{ items: [{ id, query, searchedAt }], nextCursor }`, newest first.
  - `DELETE /v1/me/searches/:id` (204, `404` for a row that is not the caller's) and `DELETE /v1/me/searches` (204, clears all).

### 2. Liked videos and my comments

- `GET /v1/me/liked-videos`: the videos the caller liked, newest like first, each a `VideoSummary` with 100's `viewer`
  progress, from the same video read scope 46's history list uses, so a video made private or deleted drops out of the page.
  Index `video_reactions (user_id, type, updated_at desc, id desc)`; keyset on `(updated_at, id)`. A viewer's likes are
  private: no route reads another user's.
- `GET /v1/me/comments`: the caller's own comments and replies, newest first, each `{ id, content, createdAt, parentId,
  likeCount, video: { id, title } }`, for readable videos only. Index `video_comments (author_id, created_at desc, id desc)
  where deleted_at is null`; keyset on `(created_at, id)`.
- Both reuse `decodeCreatedAtCursor` and the shared `Paginator`; the lists carry no delete of their own: unlike is 40's
  `PUT /v1/videos/:id/reactions` with `NONE`, delete is 42's `DELETE /v1/comments/:id`.

### 3. Where the pages live

No web code here. 73 builds the viewer's activity pages and 74 the search palette; their tickets gain the lines that read
these endpoints (73: the Searches, Liked and Comments tabs beside History; 74: "Recent searches" with a remove button when
the palette opens empty). Both list 125 in `Blocked by`.

## Acceptance criteria

- [ ] A signed-in search records one row; searching the same text with other casing or spacing moves that row to the top
      and adds none; a second page of results (`cursor` set) and an anonymous search record nothing.
- [ ] With `historyPaused` set, a search writes no row and a watch heartbeat still writes none; with it cleared, both write.
- [ ] A user's 101st distinct query removes their oldest; a row older than 90 days is gone after the housekeeping task.
- [ ] `GET /v1/me/searches` pages by keyset newest first; `DELETE /v1/me/searches/:id` removes one row, answers 404 for
      another user's id and leaves the other user's rows; `DELETE /v1/me/searches` clears only the caller's.
- [ ] `GET /v1/me/liked-videos` lists only the caller's likes, newest first, without a video that became private or was
      deleted, with `viewer` progress on each item and one query for a page of 24.
- [ ] `GET /v1/me/comments` lists only the caller's comments and replies, without removed ones or those on videos the
      caller cannot read.
- [ ] A cached search page still records for a signed-in caller, and a failing history write does not fail the search.
- [ ] `privilege-escalation.test.ts` gains rows: reading, deleting and clearing another user's searches, and a guest on every
      route here.
- [ ] Postgres and in-memory repositories pass one shared contract spec, each with its own 1:1 spec (Rule 12).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts`
      (no diff) green, with output in the PR.

## Out of scope

- A unified activity timeline and `DELETE /v1/me/activity`; each list stays with its owner (see above).
- Per-user watch time, top channels, session logs and heartbeat endpoints: 65's beacon stays anonymous and 46 owns the
  playhead. A "your watch time" card would need per-viewer accumulation and is a ticket of its own if wanted.
- Click-through attribution, result counts and search "relevance feedback".
- A personal data export for viewers: [118](118-creator-data-portability-and-api.md) is channel-scoped; these lists are
  complete and keyset-paged, so an export can be built over them later.
- The pages, the palette change and the privacy switch's copy: 73, 74 and [72](72-frontend-settings-customization-system.md).

## Testing plan

- Domain: `it.each` over query-key normalization (case, internal whitespace, trimming, very long text).
- Repositories: one contract spec over both implementations: upsert moves a row, the 100-row cap, keyset paging, scoped
  remove and clear.
- Services: record skipped when paused, on a later page and for a guest; a failing repository does not fail `search`.
- Routes: contract tests with `app.inject()` for each endpoint, the 401 and 404 cases and keyset paging.
- Housekeeping: the purge task over fixed-clock rows.

## Open questions

- Decided: one switch, `privacy.historyPaused`, pauses watch and search history, so the privacy page keeps one row and a
  viewer who paused history is not recorded anywhere. [72](72-frontend-settings-customization-system.md)'s label says
  "watch and search history". Split it into two flags only if a viewer needs one without the other.
- Decided: a pause takes effect on the next write-through; 46's buffer may still refresh the resume position for up to a
  minute, which is the playhead and not a history row.
- Decided: search history keeps the newest 100 queries for at most 90 days, because a trail that never ends is a liability
  and no feature reads further back.
- Decided: the Redis suggestion index (47) is unchanged and stays unattributed: it holds counts of plain queries, never a user.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5 (the table and indexes), §6.1 and §9.8 updated; the OpenAPI document regenerated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
