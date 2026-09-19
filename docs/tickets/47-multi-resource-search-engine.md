# 47: Multi-resource search engine — unified weighted full-text search across videos, channels & playlists with Redis caching

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#47](https://github.com/szebest/taitube-platform/issues/47) |
| Size | L |
| Blocked by | 38 — User & channel identity · 44 — Creator studio · 46 — YouTube-grade playlists |
| Blocks | 49, 74 |
| Spec | [SDD §5 Domain model & DDL](../SDD.md#5-domain-model-database-schema) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

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

- [ ] Database migration:
  - Enables `pg_trgm` extension.
  - Adds generated stored `search_vector tsvector` columns and GIN indexes to `videos`, `channels`, and `playlists`.
  - Creates trigram indexes on `channels.handle`, `channels.display_name`, and `playlists.title`.
- [ ] `SearchRepositoryPort` in `@taitube/core/repositories/search-repository.port.ts` supporting multi-entity queries.
- [ ] Modular `PostgresSearchRepository` in `adapters/postgres/repositories/postgres-search-repository.ts` (<= 250 lines).
- [ ] `InMemorySearchRepository` double with `.clear()`.
- [ ] Endpoints:
  - `GET /v1/search`:
    - Supports `type=all|video|channel|playlist`.
    - Returns typed polymorphic items array with discrimination field `type`.
    - Filters enforce: only `status = 'READY'` videos, active channels, and `visibility = 'public'` playlists.
    - Integrates Redis query cache.
  - `GET /v1/search/suggestions?q=...`:
    - Returns combined query text and channel quick-hit suggestions.
- [ ] Integration tests via `app.inject()`:
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

- [ ] All ACs green under `pnpm test` and `bun test`.
- [ ] `pnpm typecheck && pnpm lint` pass with zero warnings or errors.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
