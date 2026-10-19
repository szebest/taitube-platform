# 58: Modern browse layout — responsive navigation, category pills & video card micro-interactions

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#58](https://github.com/szebest/taitube-platform/issues/58) |
| Size | L |
| Blocked by | 53 - Frontend data layer · 55 - Design system · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app |
| Blocks | 62, 63, 74, 96, 100, 101, 102 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** in-progress

> **Slices a to f merge now.** 58g to 58j follow later as a fresh stack built on [95](95-design-system-2.md)'s slices ag, ah, ah.2, aj, ak, ao, ap, aq and ar and web's kit. `/trending` becomes `/explore` (Trending as its first tab) then, and 58f's card moves onto 95's `VideoCard`.

> **Coordination with [95](95-design-system-2.md).** 58a to 58c (the search route, the header, the drawer,
> rail and bottom bar) are merged on this stack. 58c's shell moves into web's app kit in 95's move-only slice ai,
> then 95's slice aj splits it (the kit's `AppShell` presentational, the smart wrapper in `features/shell`), and this
> ticket mounts it instead of owning it. 58g onward restarts once 95's slices ag, ah, ah.2, aj, ak, ao, ap, aq and ar
> are merged and builds the pages from web's kit (`VideoCard`, `Shelf`, `ChipBar`, `PickOfTheDay`) and the shared
> states in `@vp/components` (95 sections 6 and 7), to the anatomy in
> [docs/design/README.md section 8](../design/README.md#8-surfaces). Every card and row is a smart wrapper in
> `features/browse/components/` that takes the video and its placement and reads the rest from hooks
> ([docs/design/architecture.md section 5](../design/architecture.md#5-smart-wrappers-in-the-apps)); 95 ships
> `FeedVideoCard` as the reference.

> **Data sources.** Every section has a backend, some of it still to come; until then the section renders the
> stated fallback through its own query factory, so the source swaps without touching the page. Home shelves and
> reasons: [100](100-home-shelves-related-videos.md) (fallback: the feed by category). Pick of the day:
> [101](101-pick-of-the-day-curation.md) (fallback: the top trending video). Shorts shelf and the channel's Shorts
> tab: [102](102-shorts.md) (hidden until then). Live now and the rail's live dot:
> [76](76-live-streaming-rtmp-whip-llhls-packaging-chat.md) (hidden until then). Start here:
> [96](96-channel-featured-videos-start-here.md). Playlists and About tabs: [104](104-channel-page-data.md) (hidden
> until then).

> **Ticket 85 note:** the `Intl.RelativeTimeFormat` / `Intl.NumberFormat` guidance in *Notes* below is now
> owned by a package: use `relative`, `compact`, `views` and `duration` from `@vp/intl` rather than building
> formatters in this ticket. The duration badge (`12:45`) is `duration`. See [85](85-universal-intl-formatting-message-core.md).

> **Builds on 89.** Replaces these legacy pages from [89](89-web-tanstack-start-foundation.md)'s table: the root
> layout (`src/layout`, `DefaultLayout` with header and sidebar), `/` (`src/modules/AllVideosPage`), `/trending`
> (`src/modules/Trending`), `/subscriptions` and `/subscriptions/videos` (`src/modules/Subscriptions`,
> `src/modules/SubscriptionVideos`) and `/channel/$channelId` (`src/modules/UserPage`). This ticket owns deleting
> those folders, their RTK Query endpoints and their SCSS if 53 and 55 have not already. The login control in
> the header is [56](56-frontend-universal-auth-session-security.md)'s.

## What to build

### 1. App shell

- 95's `AppShell` mounted from `__root.tsx` in place of `DefaultLayout`, with the breakpoints and rail of
  [docs/design/README.md section 7](../design/README.md#7-layout-and-the-shell): bottom tab bar on compact,
  collapsed rail on medium and expanded, open rail on large. The rail state lives in a cookie so the server
  renders the layout the browser hydrates.
- Rail sections: Home, Shorts, Subscriptions, Explore,
  Live; You (History, Watch later, Playlists, Your videos); then the subscribed channels. A link to a route
  that does not exist yet (73, 60, 72) is hidden until the route lands; typed `Link` makes a dead link a
  compile error.
- Header search box: a plain input with `/` to focus and a clear button that navigates to `/search?q=`.
  [74](74-frontend-multi-resource-search-discovery-ui.md) turns it into the command palette.

### 2. Browse pages

| URL | Replaces | Data |
|---|---|---|
| `/` | `/` (`AllVideosPage`) | public feed, subscriptions feed, category feeds |
| `/explore` | `/trending` | trending feed, active categories |
| `/feed/subscriptions` | `/subscriptions/videos`, under `_authed` | subscribed channels' videos ([41](41-channel-subscriptions-subscriber-feed.md)) |
| `/feed/channels` | `/subscriptions`, under `_authed` | subscribed channels list |
| `/channel/$channelId` | `/channel/$channelId` (`UserPage`) | channel header and its videos |

- Each route file under `apps/client/web/src/routes/` is thin: `validateSearch` (Zod, `category` on the feeds,
  `tab` on `/explore` and the channel page), a loader calling `queryClient.ensureInfiniteQueryData(...)` with
  the feed and channel factories 53 put in `features/feed/api/` and `features/channels/api/`, and a component
  reading it with `useSuspenseInfiniteQuery`. Page composition and the smart wrappers go in `features/browse/`;
  the presentational components come from web's app kit and `@vp/components`.
- The old URLs (`/trending`, `/subscriptions`, `/subscriptions/videos`) redirect to the new ones in the route
  `beforeLoad`.
- Each route's `pendingComponent` is composed from the skeletons of the patterns it renders, so it has the
  loaded layout's exact dimensions; empty, error and partial states are 95's `EmptyState`, `ErrorState` and
  `SectionError` ([docs/design/README.md section 8, States](../design/README.md#states)).

### 3. Home `/`

In the order of [docs/design/README.md section 8, Home](../design/README.md#home):

1. `ChipBar` of active categories from [37](37-admin-category-management-cached-api.md)'s public API; the
   selection is the `category` search param, not component state, and filters every section below.
2. `PickOfTheDay`: until curation exists (a follow-up ticket), the fallback pick is the top video of the
   trending feed, with the window counting to the next UTC midnight.
3. Continue watching: a `Shelf` of partly watched videos from
   [46](46-youtube-playlists-watch-history-engine.md)'s history, signed in only.
4. Shelves with a reason in their heading: "From channels you subscribe to" (signed in, 41's feed), then one
   per active category.
5. Shorts: a `Shelf` of `poster` cards.
6. Live now: a `Shelf` of live cards.
7. "Everything": the infinite `grid` of the public feed behind its heading; the next page is prefetched when
   the sentinel nears the viewport.

A section with no data source yet, or no items, is not rendered (Shorts and Live now until their features
ship).

### 4. Explore `/explore`

- `Tabs` whose first and default tab is Trending (the trending feed as a `grid`); the Categories tab renders
  one `Shelf` per active category, each heading linking to `/?category=<slug>`. The tab is the `tab` search
  param.

### 5. Channel page `/channel/$channelId`

- `ChannelHeader` (banner, identity row, Subscribe), then the `StartHereShelf` with `source="popular"`: the
  channel's six most-viewed public uploads under the heading "Most watched". The loader reads them through one
  query factory, `channelStartHereQueryOptions`, so [96](96-channel-featured-videos-start-here.md) swaps its
  source to the featured endpoint (the creator's pinned videos, the same fallback when none are pinned) without
  touching the page.
- Tabs from [docs/design/README.md section 8, Channel page](../design/README.md#channel-page): Home, Videos,
  Shorts, Live, Playlists, Community, About. A tab whose feature has not shipped is not rendered. The tab is
  the `tab` search param.

### 6. Video card

- `VideoCard` from 95: byline (16 px avatar dot and channel in `overline`), duration, title clamped to two
  lines, views and relative date formatted through `@vp/intl` before they are passed. Cards in a shelf carry
  the shelf's reason label ("New from a channel you subscribe to").
- Expand on hover (pointer devices only): after 500 ms the card grows into its raised panel with the sprite
  preview stepping through the sprite sheet (`spriteUrl`), two lines of description, and Save and Queue once
  73 lands; timers are cleared on leave and unmount.
- Three-dot menu on `DropdownMenu`: Share now; Save to Watch later and Add to playlist once 73 lands.

### Smart wrappers

Over web's kit, in `features/browse/components/` and `features/channels/components/`: `ReasonShelf` and `ContinueWatchingShelf` over `Shelf`, `CategoryChipBar` over `ChipBar`, `HomePickOfTheDay` over `PickOfTheDay`, `ChannelPageHeader` over `ChannelHeader`, `ChannelStartHere` over `StartHereShelf`. The shell wrappers are 95's and this ticket mounts them; [100](100-home-shelves-related-videos.md) and [96](96-channel-featured-videos-start-here.md) swap the sources of the shelves and Start here. Props, hooks and the feature folder of each are in [the wrapper table](../design/apps/web/README.md#smart-wrappers); 95 builds the kit parts and the reference wrapper, this ticket builds these.

## Delivery slices

1. Search route, header, drawer, rail and bottom bar (58a to 58c, merged); remounted as 95's `AppShell` after
   its slice aj.
2. Video summaries carry their channel and sprite geometry (58d), the channel's public videos endpoint and the
   trending feed.
3. Home in the order above with the Everything grid and skeleton; `AllVideosPage` deleted.
4. `/explore` with the redirect; `Trending` deleted.
5. `/feed/subscriptions` and `/feed/channels` with redirects; `Subscriptions` and `SubscriptionVideos` deleted.
6. Channel page with `ChannelHeader`, Start here and tabs; `UserPage` deleted.
7. Expand on hover and the three-dot menu.

## Acceptance criteria

- [ ] The shell is 95's `AppShell`, rendering the bottom tab bar, collapsed rail and open rail at the guide's
      breakpoints, with no layout jump on hydrate.
- [x] `/` focuses the search input; submitting navigates to `/search?q=<term>`.
- [ ] Every page in the table loads its first page in the route loader; server-rendered HTML contains the
      first cards, and the browser does not refetch them on hydrate.
- [x] Scrolling a feed loads the next page, prefetched before the sentinel is visible.
- [ ] Home renders its sections in the guide's order; a section with no source or no items renders nothing
      (not an empty shelf); Pick of the day shows the fallback pick and its window.
- [ ] `/explore` opens on Trending; the Categories tab shows one shelf per active category; `/trending`
      redirects to `/explore`.
- [ ] The channel page renders only the tabs whose feature has shipped, and the Start here shelf.
- [ ] Selecting a chip updates `?category=` and the feed; a direct link with `?category=` renders
      filtered on the server.
- [ ] `/subscriptions` and `/subscriptions/videos` redirect to their new URLs.
- [ ] Each page's `pendingComponent` is built from the patterns' skeletons, and swapping it for the loaded page
      shifts nothing (CLS under 0.05 on first load of `/`, `/explore` and a channel page).
- [ ] Every card is a `VideoCard` variant; `features/browse/` defines no card, shelf, chip, skeleton, empty or
      error component of its own.
- [ ] Card shows byline, duration, clamped title, views and relative date, and a shelf card its reason label;
      expand on hover starts after 500 ms on a pointer device only and leaves no timer behind.
- [ ] Shelves and the chip bar scroll with the keyboard (arrow keys move between items, focus scrolls the item
      into view), and their chevrons appear only when the row overflows.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] The legacy folders listed above, their RTK Query endpoints and SCSS are deleted.
- [ ] Integration specs per page through the `renderRoute` helper from [54](54-frontend-testing-trophy-vitest-msw-integration-suite.md) with MSW.

## Out of scope

- Watch page: [59](59-video-watch-page-responsive-layout-enhancements.md).
- Search suggestions: 74.
- List virtualization: [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).

## Notes for the implementer

- Formatting is not built here. `@vp/intl` owns `relative` (`2 days ago`), `compact`/`views` (`1.2M views`) and `duration` (`12:45`), all on native `Intl` with no external date or number library. If a formatter this ticket needs is missing, add it to `@vp/intl` with its test, not to a component.

## Testing plan

- Breakpoints: shell variant per viewport width as one `it.each`.
- Expand on hover with fake timers: nothing at 499 ms, preview at 500 ms, cleared on leave.
- Redirects: each old URL as one `it.each` over memory history.
- Home order and hidden sections: one `it.each` over signed-in and guest with MSW fixtures that empty a source.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Layout verified on mobile, tablet and wide desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
