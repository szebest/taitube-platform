# 74: Frontend multi-resource search & discovery UI — polymorphic results, filter chips & auto-complete suggestions

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#74](https://github.com/szebest/taitube-platform/issues/74) |
| Size | M |
| Blocked by | 47 - Multi-resource search · 58 - Browse layout · 89 - TanStack Start foundation |
| Blocks | 62 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** A new page: no legacy module to replace (the legacy app has no search). It uses 89's route
> structure and the header search box from [58](58-modern-browse-layout-microinteractions-motion.md).

## What to build

Route `apps/web/src/routes/search.tsx`, feature code in `apps/web/src/features/search/`, backend
[47](47-multi-resource-search-engine.md).

### 1. Results `/search`

- `validateSearch`: `q` (required, trimmed), `type` (`all`, `video`, `channel`, `playlist`, default `all`),
  `sort` (`relevance`, `date`, `views`, default `relevance`).
- `loaderDeps` on those params and a loader calling `ensureInfiniteQueryData(searchQueryOptions(...))`, so
  results render on the server and a shared URL shows the same page. The component reads them with
  `useSuspenseInfiniteQuery`; the `pendingComponent` is a result list skeleton.
- Filter chips and the sort menu navigate with `replace: true`, so changing a filter does not stack history.
- Result cards by kind: video (thumbnail, duration, title with matched terms highlighted, channel, views, date,
  snippet), channel (avatar, handle, subscribers, video count, bio, Subscribe with the optimistic mutation 53
  built), playlist (stacked thumbnails, count, owner).
- With `type=all`, a strong channel match renders as a spotlight card above the blended results.
- `fuzzyFallback: true` shows "Showing results for X. Search instead for Y"; zero hits show an empty state with
  suggested topics.

### 2. Header suggestions

- The header search input from 58 gets a suggestions popup: `GET /v1/search/suggestions?q=` debounced by 200 ms
  through a query keyed on the debounced term, text suggestions and channel quick hits.
- Combobox keyboard behaviour: arrows move, `Enter` commits, `Escape` closes; a channel hit navigates to the
  channel page, a text hit to `/search?q=`.

## Acceptance criteria

- [ ] `/search?q=react&type=channel&sort=date` renders channel results sorted by date on the server; invalid
      `type` or `sort` fall back to defaults through `validateSearch`.
- [ ] Chips and sort update the URL with `replace` and the results follow.
- [ ] Video, channel and playlist cards render with the fields above; matched terms are highlighted.
- [ ] Spotlight channel card on `type=all` when there is a strong channel match.
- [ ] Typo banner on `fuzzyFallback: true`; empty state on zero hits.
- [ ] Header suggestions are debounced, show text and channel hits, and work with the keyboard only.
- [ ] Integration specs for filter switches, suggestion keyboard navigation and card rendering, through 54's
      `renderRoute` with MSW.

## Out of scope

- Boolean operators (`AND`, `NOT`, `site:`).
- LLM summaries.
- Virtualized results: [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).

## Notes for the implementer

- Highlighting: split the title on the escaped query terms and wrap the matches in `<mark>`; no library, no
  `dangerouslySetInnerHTML`.

## Testing plan

- Keyboard: type "re", press Down twice, Enter; assert navigation to the chosen suggestion.
- Filter: click Channels, assert `?type=channel` and only channel cards.
- Typo: MSW returns `fuzzyFallback: true`, assert the banner.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Search verified in the browser.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
