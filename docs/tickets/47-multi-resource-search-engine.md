# 47: Multi-resource search engine — unified weighted full-text search across videos, channels & playlists with Redis caching

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#47](https://github.com/szebest/taitube-platform/issues/47) |
| Size | L |
| Blocked by | 38 — User & channel identity · 44 — Creator studio · 46 — YouTube-grade playlists |
| Blocks | 74 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

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

A modern video platform cannot restrict search to raw video titles alone. When users search for terms like *"Linus"*, *"Learn React"*, or *"Coding Music"*, they expect to find relevant creator **Channels**, curated **Playlists**, and individual **Videos** ranked by relevance without needing separate search screens.

This ticket delivers the **Multi-Resource Search & Discovery Engine**:

1. **Multi-Entity Inverted Indexes (PostgreSQL `tsvector` + `pg_trgm`)**:
   - **Videos Indexing (`videos.search_vector`):**
     - Weight 'A' (1.0): `title`
     - Weight 'B' (0.4): `tags`
     - Weight 'D' (0.1): `description`
   - **Channels Indexing (`channels.search_vector`):**
     - Weight 'A' (1.0): `handle` and `display_name`
     - Weight 'C' (0.2): `bio`
     - GIN trigram index on `handle gin_trgm_ops` and `display_name gin_trgm_ops`.
   - **Playlists Indexing (`playlists.search_vector`):**
     - Weight 'A' (1.0): `title`
     - Weight 'B' (0.4): `description`
     - Only indexes playlists where `visibility = 'public'`.

2. **Unified Polymorphic Search API (`GET /v1/search`)**:
   - **Query Parameters:**
     - `q`: Search query string (1–100 characters).
     - `type`: Target resource filter (`all` | `video` | `channel` | `playlist`). Defaults to `all`.
     - `categoryId`: Optional UUID category filter (applies to videos).
     - `sort`: `relevance` (default), `date`, `views`.
     - `cursor`, `limit`: Keyset pagination (default 20, max 50).
   - **Polymorphic Response Format:**
     - Returns `{ items: SearchResultItem[], nextCursor, tookMs, total, fuzzyFallback: boolean }`.
     - `SearchResultItem` is a discriminated union:
       ```ts
       type SearchResultItem =
         | { type: 'video'; data: VideoSummaryView }
         | { type: 'channel'; data: ChannelSummaryView }
         | { type: 'playlist'; data: PlaylistSummaryView };
       ```
     - When `type=all`, if an exact or strong channel match occurs (e.g. searching *"fireship"*), the channel card is pinned to the top of the search feed, followed by top videos and playlists.
   - **Row-Level Security via `drizzleWhere`:**
     - Search queries across videos and playlists MUST compose `drizzleWhere` with `videoReadScope(user)`, `playlistReadScope(user)`, and `notDeletedScope` to guarantee that private videos and private playlists are never returned to unauthorized users.

3. **Multi-Signal Relevance Scoring & Typo Fallback**:
   - **Blended Ranking:** Combines `ts_rank_cd` with logarithmic popularity metrics:
     - Videos: `Score = ts_rank_cd * log10(views_count + 10) * recency_decay`
     - Channels: `Score = ts_rank_cd * log10(subscriber_count + 10) * 1.5` (channel boost for exact name matches)
     - Playlists: `Score = ts_rank_cd * log10(video_count + 5)`
   - **Trigram Typo Recovery:** If lexical full-text query produces zero hits, automatically falls back to `similarity(title, :query) > 0.25` across all three entity tables.

4. **Ultra-Low Latency Autocomplete Suggestions Engine (`GET /v1/search/suggestions?q=...`)**:
   - Returns up to 10 typed suggestions combining popular query phrases and direct channel quick-hits:
     ```ts
     interface SearchSuggestion {
       text: string;
       type: 'query' | 'channel';
       channelId?: string;
       handle?: string;
       avatarUrl?: string;
     }
     ```
   - Sub-5ms response backed by Redis Sorted Set prefix index / Trie (`taitube:search:suggest:{prefix}`).

5. **Sub-10ms Redis Query Cache with Singleflight Stampede Protection**:
   - Caches search responses with SHA-256 query key: `taitube:search:q:{type}:{hash}` with 120s TTL.
   - Singleflight promise coalescing in Fastify: prevents database query storms when thousands of users search for breaking or trending topics simultaneously.
   - Emits `X-Cache: HIT` / `X-Cache: MISS` headers.

## Acceptance criteria

- [x] Database migration:
  - Enables `pg_trgm` extension.
  - Adds generated stored `search_vector tsvector` columns and GIN indexes to `videos`, `channels`, and `playlists`.
  - Creates trigram indexes on `channels.handle`, `channels.display_name`, and `playlists.title`.
- [x] `SearchRepositoryPort` in `@taitube/core/repositories/search-repository.port.ts` supporting multi-entity queries.
- [x] Modular `PostgresSearchRepository` in `adapters/postgres/repositories/postgres-search-repository.ts` (<= 250 lines).
- [x] `InMemorySearchRepository` double with `.clear()`.
- [x] Endpoints:
  - `GET /v1/search`:
    - Supports `type=all|video|channel|playlist`.
    - Returns typed polymorphic items array with discrimination field `type`.
    - Filters enforce: only `status = 'READY'` videos, active channels, and `visibility = 'public'` playlists.
    - Integrates Redis query cache.
  - `GET /v1/search/suggestions?q=...`:
    - Returns combined query text and channel quick-hit suggestions.
- [x] Integration tests via `app.inject()`:
  - Multi-resource search for a shared keyword returns a mix of matching videos, channels, and playlists.
  - Channel name match ranks prominently at the top when searching channel handle.
  - Filter `type=playlist` returns only playlists; `type=channel` returns only channels.
  - Typo query (e.g. *"javascrip"*) falls back to trigram matches across resources.
  - Redis cache returns `X-Cache: HIT` on repeated search.

## Out of scope

- Distributed external search cluster (Elasticsearch / Meilisearch) — all search runs directly on PostgreSQL to preserve local-first €0 budget.
- Semantic neural vector embeddings.

## Notes for the implementer

- **Polymorphic Query Execution:** To keep query complexity low and within the 250-line file limit, execute parallel queries across `videos`, `channels`, and `playlists` when `type=all`, then merge and sort by normalized relevance score in memory.
- **Cache Normalization:** Always trim and lowercase search query strings before hashing.

## Testing plan

- Query builder unit tests verifying correct tsquery construction for each resource.
- Multi-resource parity tests in-memory vs PostgreSQL.
- Typo tolerance test verifying misspelled creator handles and video titles resolve correctly.

## Definition of Done

- [x] All ACs green under `pnpm test` and `bun test`.
- [x] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [x] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [x] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.

## Open questions

- Decided: everything runs on Postgres, nothing external. Index design: a generated stored `tsvector` per table with a GIN index (a stored column keeps ranking from re-parsing text on every query, and the generation keeps it in step with every write without a trigger), and `gin_trgm_ops` indexes on the short fields the fallback compares (`channels.handle`, `channels.display_name`, `playlists.title`, plus `videos.title`, which the fallback also reads). The playlist indexes are partial on `visibility = 'public' AND NOT is_system`, the only rows search reads. GIN over GiST because the data is read far more than written and GIN lookups are faster.
- Decided: the `search_vector` columns live only in the custom migration `0014_search_vectors.sql`, not in the Drizzle tables, because every `select()` of a video, channel or playlist would otherwise carry the vector. `@vp/db` exposes them as `searchVectors` in `search-schema.ts`. Tags go through an `IMMUTABLE` `search_tags_text(text[])`, as `array_to_string` is only `STABLE` and a generated column refuses it.
- Decided: the `simple` text search configuration, not `english`. It is language neutral (handles, tags, titles in any language, no stop words dropping `the`), and the in-memory double tokenizes exactly the same way. Inflections and typos go through the trigram fallback.
- Decided: the fallback uses `word_similarity` through the `<%` operator at 0.6 (the pg_trgm default, served by the trigram indexes) instead of `similarity(title, q) > 0.25`. Whole-string `similarity` of `javascrip` against `Learn JavaScript in one hour` is far below 0.25, while its word similarity is 0.9.
- Decided: relevance pagination. Every hit carries the key it was ordered by; the merged order is key descending, then channel, video, playlist, then id descending. The cursor is `{ sort, mode, instant, key, kind, id }`: refused under another sort (as 44's library cursor is), a fuzzy walk stays fuzzy, and `instant` fixes the recency decay for the whole walk. Postgres computes and compares its own doubles, so no JavaScript arithmetic sits in a bound.
- Decided: the exact channel pin is `+1000` on the channel's score, so it is part of the keyset order rather than a splice into the first page. `1.5` boosts every channel, as in the ticket's formula.
- Decided: search reads as an anonymous viewer. Videos compose `videoReadScope(null)`, `notDeletedScope`, `public` and `READY`; playlists `playlistReadScope(null)`, `public` and not system; a playlist's `videoCount`, cover and views count only the videos an anonymous viewer may watch. A cached page, a count and a snippet-free card are therefore the same for everyone, and an owner does not find their own private videos here (the creator studio is where they are listed).
- Decided: "active channels" is every channel; the schema has no channel state to filter on.
- Decided: `sort=views` is the audience of each kind: views for a video, subscribers for a channel, the summed views of a playlist's watchable videos. `categoryId` narrows videos only.
- Decided: the port is `SearchRepositoryPort` in `packages/server/core/repositories/search-repository.ts` (no `.port.ts` suffix and no `@taitube` scope in this repo).
- Decided: a `q` that is blank after trimming, or over 100 characters, is the rule's `422 VALIDATION_FAILED`, like every other service rule; transport errors stay `400`.
- Decided: a query is recorded in the suggestion index only when its first page found something as typed (no fuzzy fallback) and it holds plain words (no quotes, `or` or `-` exclusions), and a text counts once per 10-minute window (`SET NX` on `taitube:search:counted:{text}`), so one client repeating a query cannot lift it. Each prefix keeps 1000 members by space-saving (a full set drops its least searched member and the newcomer starts at that count plus one, one Lua script per record) and serves 10, so a new query always gets in and old favourites cannot freeze a prefix. Only letters and digits are recorded, so `react!` and `react` are not two suggestions. Prefixes of up to 20 characters, 7-day TTL.
- Decided: both routes are rate limited per caller (the user id, else the IP), 60 searches and 120 suggestion reads a minute (`SEARCH_RATE_LIMITS`). Moving the caches to a Redis of their own with an eviction policy is a follow-up ticket.
- Decided: a playlist's search `videoCount`, cover and views count only its `public` `READY` videos (no unlisted). The playlist page itself still counts what `watchableVideoScope` lets through; that is a separate follow-up.
- Decided: `lower(handle)` and `lower(display_name)` btree indexes (`text_pattern_ops`) serve the exact-match pin and the suggestion prefix, checked with `EXPLAIN` in `search-schema.test.ts`.
- Decided: a query with no positive word (`-lofi`, `or`) is a `422`, as `websearch_to_tsquery` would turn it into a match on nearly everything. A negated phrase (`-"lo fi"`) holds words, so the repository asks Postgres (`querytree(...) = 'T'`) before searching and the service answers the same `422`; the in-memory double reads words only and always says the query narrows.
- Decided: rate limits are per API process and key on `req.ip` behind the ingress; trusting forwarded headers and a shared limiter store across replicas is a follow-up ticket.
