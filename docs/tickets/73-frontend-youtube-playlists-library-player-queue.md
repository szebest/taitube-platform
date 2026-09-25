# 73: Frontend YouTube-grade playlist & watch history library — watch history feed, playlist manager & player queue tray

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#73](https://github.com/szebest/taitube-platform/issues/73) |
| Size | L |
| Blocked by | 46 - Playlists and watch history engine · 57 - Video player · 59 - Watch page · 69 - URL state and modal routing · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** New pages: no legacy module to replace. It uses 89's route structure and loader pattern,
> the watch page from [59](59-video-watch-page-responsive-layout-enhancements.md) and `useUrlModal` from
> [69](69-frontend-url-state-search-params-modal-routing.md).

## What to build

Feature code in `apps/web/src/features/library/`, query and mutation factories in
`features/library/api/` over [46](46-youtube-playlists-watch-history-engine.md)'s endpoints. Routes are thin:
`validateSearch`, a loader with `ensureQueryData` / `ensureInfiniteQueryData`, a `pendingComponent` skeleton.

### 1. Watch history `/feed/history` (under `_authed`)

- Infinite list grouped by day (today, yesterday, this week, older), each card with a resume progress bar.
- A card links to `/watch/$videoId?t=<progressSeconds>`, so playback resumes where it stopped.
- Remove one item, clear all (confirmation through `useUrlModal`), pause history, filter by title (`q` in
  `validateSearch`).
- Resume progress is written here: a small hook subscribes to the player's `onTimeUpdate` and saves progress
  to 46's history endpoint, throttled, and skips it while history is paused.

### 2. Save to playlist dialog (`?modal=save-to-playlist&videoId=`)

- A URL modal through `useUrlModal`, opened from the card three-dot menu ([58](58-modern-browse-layout-microinteractions-motion.md))
  and the watch page Save button (59).
- Lists the viewer's playlists with Watch Later pinned first, each with a checkbox for whether the video is in
  it. Toggling is an optimistic mutation with rollback.
- Inline create: TanStack Form with title (1 to 100 chars) and privacy; submitting creates the playlist, adds
  the video and shows a toast.

### 3. Playlists `/feed/playlists` and `/playlist?list=<id>`

- `/feed/playlists`: the viewer's playlists as a grid.
- `/playlist`: `list` is the route's `validateSearch` param. Hero card (stacked thumbnails, title,
  description, owner, count and total duration, visibility), Play all, Shuffle, Share.
- Owner controls: inline title and description edit, privacy, delete with confirmation.
- Ordered list with drag-to-reorder (optimistic, one batched `PUT /v1/playlists/:id/reorder` on drop) and a
  per-item menu (remove, move to top, move to bottom).

### 4. Queue on the watch page (`/watch/$videoId?list=&index=`)

- 59's watch route `validateSearch` gains `list` and `index`; the loader also ensures the playlist when
  `list` is set.
- Queue tray beside the player (above comments on mobile and in theater mode): title, owner, `3 / 24`, shuffle,
  loop (off, playlist, single), auto-scroll to the current item.
- On the player's `onEnded`, navigate to the next item with `replace` so back leaves the playlist in one step.
  Previous and next controls in the player move through the queue. If playback was paused by the user or
  autoplay is blocked, the next video waits on its first frame.

## Delivery slices

1. Watch history page with resume links and the progress writer hook.
2. History management: remove, clear, pause, filter.
3. Save to playlist dialog with optimistic toggles and inline create.
4. `/feed/playlists` and `/playlist` detail with owner controls.
5. Drag-to-reorder and item menu.
6. Queue tray, autoplay, previous and next, loop and shuffle.

## Acceptance criteria

- [ ] `/feed/history` lists watched videos by day with resume bars; opening one starts at its saved position.
- [ ] Progress is saved while watching and not saved while history is paused.
- [ ] Remove one and clear all update the list optimistically and roll back on failure.
- [ ] `?modal=save-to-playlist&videoId=<id>` opens the dialog from a direct link, lists playlists with Watch
      Later first and the right checked state; toggling updates instantly with a toast.
- [ ] Inline create adds a playlist containing the video.
- [ ] `/playlist?list=<id>` renders the hero and list on the server; owner controls appear only through `useCan`.
- [ ] Drag-to-reorder sends one reorder request with the new order and rolls back on failure.
- [ ] `/watch/<id>?list=<pl>&index=0` shows the queue tray; the end of the video goes to `index=1`; previous,
      next, loop and shuffle work.
- [ ] Integration specs for resume, the dialog mutations, reorder and queue advance, through 54's `renderRoute`
      with MSW.

## Out of scope

- Collaborative playlists.
- Recommendations added to playlists.

## Notes for the implementer

- Reorder: update the cache on drop, then send the request; use `@dnd-kit/sortable` for keyboard-accessible
  dragging.

## Testing plan

- Dialog: toggle a checkbox, assert the mutation and the optimistic check.
- Queue: fire the player's `onEnded`, assert `index` goes from 0 to 1 and the next video loads.
- Reorder: drag item 3 to 1, assert the `PUT` payload.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Playlist and history flows verified in the browser.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
