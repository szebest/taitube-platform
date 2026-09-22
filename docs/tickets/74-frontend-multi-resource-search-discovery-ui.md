# 74: Frontend multi-resource search & discovery UI — polymorphic results, filter chips & auto-complete suggestions

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#74](https://github.com/szebest/taitube-platform/issues/74) |
| Size | M |
| Blocked by | 47 — Multi-resource search · 58 — Modern browse layout · 69 — Frontend URL-driven state |
| Blocks | 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

## What to build

Searching on a modern video platform must be frictionless, fast, and multi-faceted. Users don't just search for individual video titles—they search for creators to subscribe to and playlists to binge. Presenting raw, unformatted video links or requiring separate search screens creates cognitive friction.

This ticket delivers the **Frontend Multi-Resource Search & Discovery Experience**:

1. **Polymorphic Search Results View (`/search?q=...`)**:
   - Integrated with the multi-resource search backend (Ticket 47) and URL-driven state (Ticket 69).
   - **Filter Chip Bar:**
     - Horizontal pill row: `All`, `Videos`, `Channels`, `Playlists`.
     - Toggling chips updates URL search parameters via `replace: true` (`/search?q=react&type=channel`).
   - **Sort & Filter Bar:**
     - Dropdown menu for sorting: `Relevance` (default), `Upload date` (`date`), and `View count` (`views`).
   - **Polymorphic Result Item Rendering:**
     - **`<VideoSearchCard />`:** Displays 16:9 thumbnail with duration badge, title with matched search query terms highlighted in neon amber, channel avatar and verified badge, view count, relative date, and description snippet.
     - **`<ChannelSearchCard />`:** Prominently featured banner/card with large 80px channel avatar, display name, handle (`@creator`), subscriber count, video count, bio excerpt, and an inline "Subscribe" action button with optimistic update.
     - **`<PlaylistSearchCard />`:** Stacked thumbnail artwork with gradient dark overlay badge showing total video count (e.g. `24 videos` with playlist icon), playlist title, channel name, and "View full playlist" CTA.
     - When `type=all`, an exact or top-ranked channel match renders as a spotlight card at the very top of results, followed by blended video and playlist items.

2. **Global Auto-Complete & Channel Quick-Hits**:
   - Integrated into the global header search input (activated instantly with `/` keyboard shortcut from any page).
   - Fetches suggestions from `GET /v1/search/suggestions?q=...` with 200ms input debounce.
   - **Mixed Suggestion Dropdown:**
     - Displays text query suggestions with search magnifying glass icon.
     - Displays creator channel quick-hits with mini avatar and subscriber count (clicking immediately navigates to channel profile).
   - **Full Keyboard Navigation:**
     - `ArrowDown` / `ArrowUp` to navigate through suggestion rows.
     - `Enter` to commit selection.
     - `Escape` to close dropdown.

3. **Typo Feedback & Empty State Experience**:
   - When backend returns `fuzzyFallback: true`:
     - Displays an interactive banner: *"Showing results for **{suggested}**. Search instead for **{original}**"*.
   - When query produces zero hits:
     - Displays custom retro TV static graphic with friendly copy ("No results found for your search") and suggestion tags ("Try searching for Gaming, Music, or Tech").

## Acceptance criteria

- [ ] `/search` route implemented in `apps/web/src/routes/search.tsx` reading and syncing URL search params (`q`, `type`, `sort`).
- [ ] Top filter chip bar allows switching between `All`, `Videos`, `Channels`, and `Playlists`.
- [ ] Polymorphic result list rendering:
  - `<VideoSearchCard />` with 16:9 thumbnail, duration badge, title, channel avatar, views, and description.
  - `<ChannelSearchCard />` with avatar, subscriber count, bio, and inline Subscribe button.
  - `<PlaylistSearchCard />` with stacked thumbnail effect and video count overlay.
- [ ] Spotlight channel card rendered at top of `type=all` results when strong channel match exists.
- [ ] Header search input opens suggestion popup with `/` hotkey and debounced query fetching.
- [ ] Suggestion dropdown supports both text suggestions and channel quick-hits with keyboard navigation (`Up`, `Down`, `Enter`, `Esc`).
- [ ] Typo fallback banner rendered when `fuzzyFallback: true`.
- [ ] Empty search state renders friendly graphic and suggested search topics.
- [ ] Vitest integration tests in `apps/web/src/__tests__/search.integration.test.tsx` verifying filter switches, suggestion keyboard navigation, and polymorphic card rendering.

## Out of scope

- Advanced boolean search operators (`AND`, `NOT`, `site:`).
- AI/LLM search summarization.

## Notes for the implementer

- **Highlighting Matches:** Use a lightweight regex helper to wrap matching substrings in `<mark className="bg-transparent text-amber-400 font-semibold">` without external dependencies.
- **File Length Discipline:** Keep each search card and filter component <= 250 lines.

## Testing plan

- Keyboard navigation test: Simulate typing "re", press Down arrow twice, press Enter; verify router navigates to selected suggestion query.
- Filter test: Click "Channels" filter chip; assert URL updates to `?type=channel` and only `<ChannelSearchCard />` items render.
- Typo banner test: Mock response with `fuzzyFallback: true`; assert correction banner appears.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test` (or `pnpm test`).
- [ ] Multi-resource search verified in browser testing.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
