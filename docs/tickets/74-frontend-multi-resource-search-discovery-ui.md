# 74: Frontend multi-resource search & discovery UI — polymorphic results, filter chips & auto-complete suggestions

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#74](https://github.com/szebest/taitube-platform/issues/74) |
| Size | M |
| Blocked by | 47 - Multi-resource search · 58 - Browse layout · 89 - TanStack Start foundation · 91 - Web import aliases · 95 - Design system 2 · 125 - Viewer activity |
| Blocks | 62 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** A new page: no legacy module to replace (the legacy app has no search). It uses 89's route
> structure and the header search box from [58](58-modern-browse-layout-microinteractions-motion.md).

## What to build

Route `apps/client/web/src/routes/search.tsx`, feature code in `apps/client/web/src/features/search/`, backend
[47](47-multi-resource-search-engine.md). Search is the surface in
[docs/design/README.md section 8, Search](../design/README.md#search): the command palette is the entry and
the results page is one Enter away, both built from [95](95-design-system-2.md)'s patterns (section 6);
`features/search/` defines no card, skeleton or state UI of its own.

### 1. Results `/search`

- `validateSearch`: `q` (required, trimmed), `type` (`all`, `video`, `channel`, `playlist`, default `all`),
  `sort` (`relevance`, `date`, `views`, default `relevance`).
- `loaderDeps` on those params and a loader calling `ensureInfiniteQueryData(searchQueryOptions(...))`, so
  results render on the server and a shared URL shows the same page. The component reads them with
  `useSuspenseInfiniteQuery`; the `pendingComponent` is composed from the result patterns' skeletons.
- Filter chips (`ChipBar`) and the sort menu (`DropdownMenu`) navigate with `replace: true`, so changing a
  filter does not stack history.
- Result cards by kind: video as the `row` `VideoCard` (thumbnail, duration, byline, title with matched terms
  highlighted, views, date, snippet), channel (avatar, handle, subscribers, video count, bio, Subscribe with the optimistic mutation 53
  built), playlist (stacked thumbnails, count, owner).
- With `type=all`, a strong channel match renders as a spotlight on `ChannelHeader`'s identity row above the
  blended results.
- `fuzzyFallback: true` shows "Showing results for X. Search instead for Y" in a `Callout`; zero hits render
  `EmptyState` with suggested topics as chips.

### 2. Command palette

- The header search field from 58 opens 95's `CommandPalette`, and so do `/` and `Cmd K` (`Ctrl K` off Apple
  platforms) from anywhere outside an input. Opened from the keyboard it appears with no animation.
- As the viewer types, `GET /v1/search/suggestions?q=` debounced by 200 ms through a query keyed on the
  debounced term fills grouped results: videos, channels and playlists, with text suggestions.
- Opened empty, a signed-in viewer sees "Recent searches" from [125](125-viewer-activity-search-history-likes-comments.md)'s
  `GET /v1/me/searches` (the newest eight), each with a remove button; choosing one runs it. Nothing shows while history
  is paused and empty, and a guest sees none.
- Actions sit beside the results and match the query too: switch theme (one per registered theme, through
  `useAppearance`), switch mode, open Watch later, open History, upload a video (the studio). An action whose
  route does not exist yet is not listed.
- Combobox keyboard behaviour: arrows move across groups, `Enter` runs the item, `Escape` closes and returns
  focus; a channel or video hit navigates to its page, a playlist to `/playlist?list=`, and `Enter` on the
  query itself opens `/search?q=`.

### Smart wrappers

Over web's kit, in `features/search/components/`: `AppCommandPalette`, `PaletteResultItem` and `PaletteActionItem` over `CommandPalette`, `SearchVideoResult` over `VideoCard`, `SearchTypeChipBar` over `ChipBar`, `ChannelResultHeader` over `ChannelHeader`. Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Slicing plan

One PR (`ticket/74-search-discovery`): the results page and the command palette share the search queries, the result wrappers and the `/search` route, and both are M-sized. Built results first, palette second, within the one branch.

## Acceptance criteria

- [x] `/search?q=react&type=channel&sort=date` renders channel results sorted by date on the server; invalid
      `type` or `sort` fall back to defaults through `validateSearch`.
- [x] Chips and sort update the URL with `replace` and the results follow.
- [x] Video, channel and playlist cards render with the fields above; matched terms are highlighted.
- [x] Spotlight channel card on `type=all` when there is a strong channel match.
- [x] Typo banner on `fuzzyFallback: true`; empty state on zero hits.
- [x] `/`, `Cmd K` and the header field open the palette; suggestions are debounced and grouped into videos,
      channels and playlists; the palette works with the keyboard only.
- [x] The empty palette lists the viewer's recent searches, removing one calls `DELETE /v1/me/searches/:id`, and a guest
      sees no such group.
- [x] "Switch to <theme>" lists every registered theme and applies it without a reload; actions for routes
      that do not exist are absent.
- [x] The palette shows its first results within 300 ms of the last keystroke on the MSW fixture, and keeps
      the previous results visible (not a spinner) while the next query loads.
- [x] Highlighted terms and the results list read correctly in RTL, and the result rows have no layout shift
      when thumbnails load (fixed aspect ratio).
- [x] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [x] Integration specs for filter switches, palette keyboard navigation and card rendering, through 54's
      `renderRoute` with MSW.

## Out of scope

- Boolean operators (`AND`, `NOT`, `site:`).
- LLM summaries.
- Virtualized results: [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).

## Notes for the implementer

- Highlighting: split the title on the escaped query terms and wrap the matches in `<mark>`; no library, no
  `dangerouslySetInnerHTML`.

## Testing plan

- Keyboard: press `/`, type "re", press Down twice, Enter; assert navigation to the chosen item.
- Actions: type "nocturne", Enter; assert `data-theme="nocturne"` with no reload.
- Filter: click Channels, assert `?type=channel` and only channel cards.
- Typo: MSW returns `fuzzyFallback: true`, assert the banner.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Search verified in the browser.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
