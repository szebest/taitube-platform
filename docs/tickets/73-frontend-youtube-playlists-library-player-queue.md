# 73: Frontend YouTube-grade playlist & watch history library — watch history feed, playlist manager & player queue

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#73](https://github.com/szebest/taitube-platform/issues/73) |
| Size | L |
| Blocked by | 46 - Playlists and watch history engine · 57 - Video player · 59 - Watch page · 69 - URL state and modal routing · 89 - TanStack Start foundation · 91 - Web import aliases · 95 - Design system 2 · 125 - Viewer activity |
| Blocks | 115, 119, 131 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** in-progress

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** New pages: no legacy module to replace. It uses 89's route structure and loader pattern,
> the watch page from [59](59-video-watch-page-responsive-layout-enhancements.md) and `useUrlModal` from
> [69](69-frontend-url-state-search-params-modal-routing.md).

## What to build

Feature code in `apps/client/web/src/features/library/`, query and mutation factories in
`features/library/api/` over [46](46-youtube-playlists-watch-history-engine.md)'s endpoints. Routes are thin:
`validateSearch`, a loader with `ensureQueryData` / `ensureInfiniteQueryData`, a `pendingComponent` composed
from the patterns' skeletons. Every surface is built from [95](95-design-system-2.md)'s patterns (section 6):
`VideoCard` (`row` for lists, `grid` for grids), `Shelf`, `Queue`, `NowPlayingBar` and the states patterns,
to [docs/design/README.md section 8](../design/README.md#8-surfaces); `features/library/` defines no card,
list row, skeleton or state UI of its own.

### 1. The You hub `/feed/you` (under `_authed`)

- One `Shelf` each for History, Watch later, Playlists and Your videos (the viewer's uploads, linking to the
  studio), each heading linking to its full page; a shelf with no items shows one `EmptyState` line with one
  action instead of an empty row.
- It is the You tab of the compact bottom bar and the You group's heading in the rail.

### 2. Watch history `/feed/history` (under `_authed`)

- Infinite list grouped by day (today, yesterday, this week, older) of `row` cards in their partly watched
  state, the resume progress flush to the thumbnail's bottom edge.
- A card links to `/watch/$videoId?t=<progressSeconds>`, so playback resumes where it stopped.
- Remove one item, clear all (confirmation through `useUrlModal`), pause history, filter by title (`q` in
  `validateSearch`).
- Resume progress is written here: a small hook subscribes to the player's `onTimeUpdate` and saves progress
  to 46's history endpoint, throttled, and skips it while history is paused.
- Beside History, tabs for the rest of the viewer's activity over [125](125-viewer-activity-search-history-likes-comments.md)'s
  endpoints: **Searches** (`GET /v1/me/searches`, remove one, clear all), **Liked** (`GET /v1/me/liked-videos` as `row` cards;
  Unlike is 40's reaction `NONE`) and **Comments** (`GET /v1/me/comments`, each linking to its video, delete through 42).
  "Pause" here is the one `historyPaused` switch, which pauses watch and search history.

### 3. Save to playlist dialog (`?modal=save-to-playlist&videoId=`)

- A URL modal through `useUrlModal` (a `Dialog`, a `Drawer` on compact), opened from the card three-dot menu ([58](58-modern-browse-layout-microinteractions-motion.md))
  and the watch page Save button (59).
- Lists the viewer's playlists with Watch Later pinned first, each with a `Checkbox` for whether the video is in
  it. Toggling is an optimistic mutation with rollback.
- Inline create: TanStack Form with title (1 to 100 chars) and privacy; submitting creates the playlist, adds
  the video and shows a toast.

### 4. Playlists `/feed/playlists` and `/playlist?list=<id>`

- `/feed/playlists`: the viewer's playlists as a grid; no playlists renders `EmptyState` with one action,
  New playlist.
- `/playlist`: `list` is the route's `validateSearch` param. Hero card (stacked thumbnails, title,
  description, owner, count and total duration, visibility), Play all, Shuffle, Share.
- Owner controls: inline title and description edit, privacy, delete with confirmation.
- Ordered list on the `SortableList` primitive from 95 with drag-to-reorder (optimistic, one batched `PUT /v1/playlists/:id/reorder` on drop) and a
  per-item menu (remove, move to top, move to bottom).

### 5. Queue on the watch page (`/watch/$videoId?list=&index=`)

- 59's watch route `validateSearch` gains `list` and `index`; the loader also ensures the playlist when
  `list` is set.
- The viewer-owned `Queue` pattern in 59's queue slot (a `Drawer` on compact, beside the discussion in
  theater): title, owner, `3 / 24`, shuffle, loop (off, playlist, single), auto-scroll to the current item, and
  reorder by drag or keyboard. "More like this" stays below it, labelled as recommendations
  ([docs/design/README.md section 1](../design/README.md#1-who-taitube-is), principle 4).
- Queue from any card: the card's Queue action (58's expanded card and three-dot menu) appends to the
  viewer's queue, which exists without a playlist.
- On the player's `onEnded`, navigate to the next item with `replace` so back leaves the playlist in one step.
  Previous and next controls in the player move through the queue. If playback was paused by the user or
  autoplay is blocked, the next video waits on its first frame.

### 6. Persistent playback behind the now playing bar

- The player and the queue live above the routes, so leaving the watch page keeps the video playing in 95's
  `NowPlayingBar` (16:9 live picture, title and channel, play, next, the queue count, expand back to the watch
  page), above the bottom tab bar on compact. The same media element moves; playback never restarts.
- Expand returns to `/watch/$videoId` with the current time; closing the bar stops playback and keeps the
  queue.

### Smart wrappers

Over web's kit: `GlobalNowPlayingBar` over `NowPlayingBar`, `QueueVideoRow` over `VideoCard` and `WatchQueue` over `Queue` (`features/watch/components/`), `HistoryVideoRow` over `VideoCard` and `FollowedChannelsShelf` over `Shelf` (`features/library/components/`). Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Delivery slices

1. Watch history page with resume links and the progress writer hook; the You hub.
2. History management: remove, clear, pause, filter, and the Searches, Liked and Comments tabs.
3. Save to playlist dialog with optimistic toggles and inline create.
4. `/feed/playlists` and `/playlist` detail with owner controls.
5. Drag-to-reorder and item menu.
6. Queue, autoplay, previous and next, loop and shuffle.
7. Persistent playback behind the now playing bar.

## Acceptance criteria

- [ ] Switching account or channel ([129](129-multiple-accounts-and-channels.md)) shows only the new identity's library, history and queue, with no stale cache.
- [ ] `/feed/history` lists watched videos by day with resume bars; opening one starts at its saved position.
- [ ] Progress is saved while watching and not saved while history is paused.
- [ ] The Searches, Liked and Comments tabs list the viewer's own rows by keyset paging; removing a search, clearing all
      searches, unliking and deleting a comment update the list optimistically and roll back on failure.
- [ ] Remove one and clear all update the list optimistically and roll back on failure.
- [ ] `?modal=save-to-playlist&videoId=<id>` opens the dialog from a direct link, lists playlists with Watch
      Later first and the right checked state; toggling updates instantly with a toast.
- [ ] Inline create adds a playlist containing the video.
- [ ] `/playlist?list=<id>` renders the hero and list on the server; owner controls appear only through `useCan`.
- [ ] Drag-to-reorder sends one reorder request with the new order and rolls back on failure.
- [ ] `/feed/you` shows the four shelves, each linking to its page, and an `EmptyState` line for an empty one.
- [ ] `/watch/<id>?list=<pl>&index=0` shows the `Queue`; the end of the video goes to `index=1`; previous,
      next, loop and shuffle work; the queue reorders with the keyboard alone.
- [ ] Navigating from the watch page to any route keeps the video playing in the `NowPlayingBar` with no gap
      in `timeupdate` and no second media request for the current segment; expand returns to the watch page
      at the current time.
- [ ] The now playing bar takes its space in the layout, so its appearance shifts nothing (CLS under 0.05), and
      it never covers the bottom tab bar or a focused element.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] Integration specs for resume, the dialog mutations, reorder and queue advance, through 54's `renderRoute`
      with MSW.

## Out of scope

- Collaborative playlists.
- Recommendations added to playlists.

## Notes for the implementer

- Reorder: update the cache on drop, then send the request; use 95's `SortableList` (it wraps `@dnd-kit/sortable`; never import dnd-kit in the app) for keyboard-accessible
  dragging.

## Testing plan

- Dialog: toggle a checkbox, assert the mutation and the optimistic check.
- Queue: fire the player's `onEnded`, assert `index` goes from 0 to 1 and the next video loads.
- Persistent playback: a Playwright flow plays a video, navigates to `/`, asserts the bar shows and the
  `<video>` element's `currentTime` keeps advancing.
- Reorder: drag item 3 to 1, assert the `PUT` payload.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Playlist and history flows verified in the browser.
- [ ] Architecture docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
