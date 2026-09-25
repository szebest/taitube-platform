# 59: Modern video watch page — dynamic 2-column layout, interactive engagement bar & threaded comments UI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#59](https://github.com/szebest/taitube-platform/issues/59) |
| Size | L |
| Blocked by | 53 - Frontend data layer · 55 - Design system · 57 - Video player · 89 - TanStack Start foundation |
| Blocks | 62, 63, 73, 76 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Ticket 85 note:** every number, date, duration, count and list this ticket renders comes from `@vp/intl`
> (`compact`, `relative`, `duration`, `list`, `collator`, `truncate`, …) and every string from `@vp/messages`.
> Components never call `Intl.*`, `toLocaleString` or `toFixed`, and never hold a copy literal — an
> architecture test enforces both. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** Replaces the legacy watch page (`src/modules/VideoPage`) that
> [89](89-web-tanstack-start-foundation.md) carries over on `/watch/$videoId`, keeping 89's loader and
> `videoQueryOptions`. This ticket owns deleting `src/modules/VideoPage`, its RTK Query endpoints and its SCSS
> if 53 and 55 have not already.

## What to build

Route file `apps/web/src/routes/watch.$videoId.tsx`, feature code in `apps/web/src/features/watch/`, the player
from [57](57-production-video-player-hls-streaming-controls.md).

### 1. Route and data

- The loader keeps `ensureQueryData(videoQueryOptions(videoId))` and adds the channel; the page reads both
  with `useSuspenseQuery`. The viewer's reaction and subscription state stay plain `useQuery` calls in the
  components that need them (53's split between primary and secondary data).
- `validateSearch` owns `t` (start time in seconds). [73](73-frontend-youtube-playlists-library-player-queue.md)
  adds `list` and `index`.
- Comments are not in the loader: their query starts when the comments section nears the viewport, so the
  video and description render first.
- `pendingComponent` is a skeleton of this page (player box, title, rail cards, comment rows) with the loaded
  dimensions; a video that does not exist throws `notFound()` from the loader.

### 2. Layout

- Two columns on desktop (player, title, channel bar, actions, description, comments | up next rail), one
  column on mobile. Theater mode from the player puts the player full width above both columns.
- Miniplayer: when the player scrolls out of view the page docks the player's compact variant bottom-right.

### 3. Channel and engagement bar

- Channel avatar, name, subscriber count, Subscribe button (`Subscribe` / `Subscribed`) with an optimistic
  mutation against [41](41-channel-subscriptions-subscriber-feed.md).
- Like / dislike pill with optimistic counts against [40](40-high-throughput-video-reactions-counter-caching.md).
- Share: a dialog with copy link and an optional `?t=` for the current time, toast on copy. It is a plain
  dialog here; [69](69-frontend-url-state-search-params-modal-routing.md) can deep-link it later.
- Save to playlist button appears once 73 lands.

### 4. Description

- Collapsed to views, date and three lines; expanded shows the full text with links and timestamps
  (`02:15`) that seek the player.

### 5. Comments

- Threaded comments from [42](42-threaded-comments-keyset-pagination-moderation.md): sort (top, newest) as
  local state, pinned comment first, reply box, collapsible reply threads with keyset pagination through
  `useSuspenseInfiniteQuery`, edit and delete gated by `useCan`.
- The comments section has its own error boundary, so a failing comments call never breaks the video.

### 6. Up next rail

- Compact cards with a skeleton; the data source is the public feed until a related-videos endpoint exists.

## Delivery slices

1. New route component with layout, title, channel bar and description on 89's loader; `src/modules/VideoPage`
   deleted; page skeleton.
2. Subscribe and like / dislike with optimistic mutations; share dialog.
3. Comments: viewport-deferred query, threads, reply, edit, delete, own error boundary.
4. Up next rail, theater layout, miniplayer, description timestamps.

## Acceptance criteria

- [ ] `/watch/<id>` server-renders title, channel and description from the loader, with no refetch on hydrate.
- [ ] `?t=90` starts playback at 90 s; an invalid `t` is dropped by `validateSearch`.
- [ ] Unknown video renders the not-found component without a client error.
- [ ] Layout switches between two columns and one; theater mode puts the player above both.
- [ ] Subscribe and reactions update instantly and roll back on a failed mutation.
- [ ] Share dialog copies the link, with `?t=` when the checkbox is on.
- [ ] Clicking a timestamp in the description seeks the player.
- [ ] The comments request is not sent until the section nears the viewport.
- [ ] Comments show pinned first, reply threads expand and paginate, edit and delete follow `useCan`.
- [ ] A failing comments request shows a section error with retry while the video keeps playing.
- [ ] The `pendingComponent` skeleton matches the loaded layout (no layout shift when data arrives).
- [ ] `src/modules/VideoPage`, its RTK Query endpoints and SCSS are deleted.

## Out of scope

- Live chat: [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md).
- Playlist queue tray: 73.
- Virtualized comments: [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).

## Notes for the implementer

- Timestamps: `/(?:(\d{1,2}):)?(\d{2}):(\d{2})/g` finds timecodes in the description; convert to seconds and
  seek the player.

## Testing plan

- Timestamp click seeks the player.
- Subscribe toggles and rolls back on a 500 (MSW).
- Reply renders under its parent.
- Comments deferral: no comments request before the section intersects.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Watch page verified on mobile, tablet and desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
