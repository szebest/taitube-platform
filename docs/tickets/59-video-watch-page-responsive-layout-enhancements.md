# 59: Modern video watch page — dynamic 2-column layout, interactive engagement bar & threaded comments UI

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#59](https://github.com/szebest/taitube-platform/issues/59) |
| Size | L |
| Blocked by | 53 - Frontend data layer · 55 - Design system · 57 - Video player · 89 - TanStack Start foundation · 91 - Web import aliases · 95 - Design system 2 |
| Blocks | 62, 63, 73, 76, 105, 106, 113, 114, 116, 119, 120, 122 |
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

> **Data sources.** "More like this" reads [100](100-home-shelves-related-videos.md)'s related endpoint (the public
> feed until then); creator hearts and Report on comments are [103](103-comment-hearts-reports-creator-inbox.md); the
> Clip action is [105](105-clips.md) and stays hidden until it lands; live chat is
> [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md).

## What to build

Route file `apps/client/web/src/routes/watch.$videoId.tsx`, feature code in `apps/client/web/src/features/watch/`, the player
from [57](57-production-video-player-hls-streaming-controls.md). The page is the watch anatomy in
[docs/design/README.md section 8, Watch page](../design/README.md#watch-page), composed from 95's watch
patterns (`Stage`, `EngagementBar`, `LinerNotes`, `Queue`, `CommentThread`; [95](95-design-system-2.md)
section 6); `features/watch/` composes them and defines no card, skeleton or state UI of its own.

### 1. Route and data

- The loader keeps `ensureQueryData(videoQueryOptions(videoId))` and adds the channel; the page reads both
  with `useSuspenseQuery`. The viewer's reaction and subscription state stay plain `useQuery` calls in the
  components that need them (53's split between primary and secondary data).
- `validateSearch` owns `t` (start time in seconds). [73](73-frontend-youtube-playlists-library-player-queue.md)
  adds `list` and `index`.
- Comments are not in the loader: their query starts when the comments section nears the viewport, so the
  video and description render first.
- `pendingComponent` is composed from the patterns' skeletons (stage, title, liner notes, queue rows, comment
  rows), so it has the loaded dimensions; a video that does not exist throws `notFound()` from the loader.

### 2. Layout

- Two columns from expanded up: the `Stage` (the player on `media`, the ambient glow from the player's sample
  bleeding into `bg`), title, channel and `EngagementBar`, `LinerNotes`, discussion | `Queue` with "More like
  this" below it. One column below expanded, with the queue as a `Drawer` behind a Queue button on compact.
- Theater mode from the player puts the stage full width and the queue beside the discussion below it.
- Opening a video from a card morphs the card's thumbnail into the stage through 95's view transition
  (section 7).
- Nothing docks in a corner: leaving the page keeps the video playing in 95's `NowPlayingBar`, which is
  [73](73-frontend-youtube-playlists-library-player-queue.md)'s.

### 3. Channel and engagement bar

- The `EngagementBar` row: channel avatar, name, subscriber count, Subscribe button (`Subscribe` /
  `Subscribed`; the label follows 95's Follow or Subscribe question) with an optimistic mutation against
  [41](41-channel-subscriptions-subscriber-feed.md).
- Like / dislike segment with optimistic counts against [40](40-high-throughput-video-reactions-counter-caching.md).
- Share: a `Dialog` with copy link and an optional `?t=` for the current time, `Toast` on copy. It is a plain
  dialog here; [69](69-frontend-url-state-search-params-modal-routing.md) can deep-link it later.
- Save to playlist button appears once 73 lands.

### 4. Liner notes

- `LinerNotes`: views, date and three lines collapsed; expanded shows the full text with links and timestamps
  (`02:15`) that seek the player.
- The chapter strip: chapters come from timestamps in the description (two or more, the first at `00:00`),
  shown in the strip and passed to the player's seekbar; clicking one seeks to it.

### 5. Discussion

- `CommentThread` and `CommentItem` over threaded comments from [42](42-threaded-comments-keyset-pagination-moderation.md): sort (top, newest) as
  local state, pinned comment first, reply box, collapsible reply threads with keyset pagination through
  `useSuspenseInfiniteQuery`, edit and delete gated by `useCan`.
- The discussion has its own error boundary rendering `SectionError`, so a failing comments call never breaks
  the video; no comments renders `EmptyState`.

### 6. Queue and More like this

- `Queue` holds the viewer's queue (73 fills it from a playlist); without one it holds the current video
  alone. "More like this" below it is a list of `row` `VideoCard`s from the public feed until a related-videos
  endpoint exists, labelled as recommendations.

### Smart wrappers

Over web's kit, in `features/watch/components/`: `WatchStage` over `Stage`, `WatchEngagementBar` over `EngagementBar`, `WatchLinerNotes` over `LinerNotes`, `WatchCommentThread` over `CommentThread`, `VideoCommentItem` over `CommentItem`. Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Delivery slices

1. New route component with the stage, title, engagement bar and liner notes on 89's loader;
   `src/modules/VideoPage` deleted; page skeleton.
2. Subscribe and like / dislike with optimistic mutations; share dialog.
3. Discussion: viewport-deferred query, threads, reply, edit, delete, own error boundary.
4. Queue and More like this, theater layout, chapters and description timestamps, the thumbnail-to-stage
   transition.

## Acceptance criteria

- [ ] `/watch/<id>` server-renders title, channel and description from the loader, with no refetch on hydrate.
- [ ] `?t=90` starts playback at 90 s; an invalid `t` is dropped by `validateSearch`.
- [ ] Unknown video renders the not-found component without a client error.
- [ ] Layout switches between two columns and one; theater mode puts the stage full width with the queue
      beside the discussion; on compact the queue opens as a `Drawer`.
- [ ] Subscribe and reactions update instantly and roll back on a failed mutation.
- [ ] Share dialog copies the link, with `?t=` when the checkbox is on.
- [ ] Clicking a timestamp in the description or a chapter in the strip seeks the player; a description with
      fewer than two timestamps shows no strip.
- [ ] The comments request is not sent until the section nears the viewport.
- [ ] Comments show pinned first, reply threads expand and paginate, edit and delete follow `useCan`.
- [ ] A failing comments request shows a section error with retry while the video keeps playing.
- [ ] The `pendingComponent` skeleton matches the loaded layout (no layout shift when data arrives).
- [ ] The poster in the stage is the LCP element of the server render, and no other page element is
      larger above the fold.
- [ ] Loading the discussion shifts nothing above it (CLS under 0.05 on `/watch/<id>` including the comments
      load).
- [ ] The queue reorders with the keyboard alone (pick up, move, drop, announced to a screen reader) through
      the `SortableList` primitive from 95.
- [ ] With view transitions available, a card's thumbnail morphs into the stage; under reduced motion the
      navigation has no motion.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] `src/modules/VideoPage`, its RTK Query endpoints and SCSS are deleted.

## Out of scope

- Live chat: [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md).
- Filling the queue from a playlist and persistent playback in the now playing bar: 73.
- Virtualized comments: [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).

## Notes for the implementer

- Timestamps: `/(?:(\d{1,2}):)?(\d{2}):(\d{2})/g` finds timecodes in the description; convert to seconds and
  seek the player.

## Testing plan

- Timestamp and chapter clicks seek the player; chapter parsing as one `it.each` over descriptions.
- Subscribe toggles and rolls back on a 500 (MSW).
- Reply renders under its parent.
- Comments deferral: no comments request before the section intersects.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Watch page verified on mobile, tablet and desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
