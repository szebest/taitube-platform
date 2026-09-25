# 58: Modern browse layout — responsive navigation, category pills & video card micro-interactions

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#58](https://github.com/szebest/taitube-platform/issues/58) |
| Size | L |
| Blocked by | 53 - Frontend data layer · 55 - Design system · 89 - TanStack Start foundation |
| Blocks | 62, 63, 74 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

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

- Header and sidebar in `apps/web/src/features/shell/`, mounted from `__root.tsx` in place of `DefaultLayout`.
- Responsive sidebar: full drawer above 1280px, icon rail from 768px to 1280px, bottom bar below 768px.
  Collapsed state lives in a cookie so the server renders the same layout the browser hydrates.
- Sections: Home, Subscriptions, Trending; You (History, Watch Later, Playlists, Your videos); Settings. Links
  to routes that do not exist yet (73, 60, 72) are hidden until those routes land; typed `Link` makes a dead
  link a compile error.
- Header search box: a plain input with `/` to focus and a clear button that navigates to `/search?q=`.
  Suggestions are [74](74-frontend-multi-resource-search-discovery-ui.md).

### 2. Browse pages

| URL | Replaces | Data |
|---|---|---|
| `/` | `/` (`AllVideosPage`) | public feed |
| `/feed/trending` | `/trending` | trending feed |
| `/feed/subscriptions` | `/subscriptions/videos`, under `_authed` | subscribed channels' videos ([41](41-channel-subscriptions-subscriber-feed.md)) |
| `/feed/channels` | `/subscriptions`, under `_authed` | subscribed channels list |
| `/channel/$channelId` | `/channel/$channelId` (`UserPage`) | channel header and its videos |

- Each route file under `apps/web/src/routes/` is thin: `validateSearch` (Zod, `category` on the feeds), a
  loader calling `queryClient.ensureInfiniteQueryData(...)` with the feed and channel factories 53 put in
  `features/feed/api/` and `features/channels/api/`, and a component reading it with
  `useSuspenseInfiniteQuery`. New UI goes in `features/browse/`.
- Infinite feed: the next page is prefetched when the sentinel nears the viewport, so scrolling rarely waits.
- The old URLs (`/trending`, `/subscriptions`, `/subscriptions/videos`) redirect to the new ones in the route
  `beforeLoad`.
- Each route's `pendingComponent` is a skeleton of that page (card grid, channel header) built on the
  `Skeleton` primitive from 55, with the same dimensions as the real content.

### 3. Category pills

- Horizontal chip list of active categories from [37](37-admin-category-management-cached-api.md)'s public
  API, with edge fade and chevrons when it overflows. The selected category is the `category` search param,
  not component state.

### 4. Video card

- Duration badge, title clamped to two lines with a tooltip, channel avatar, views and relative date through
  `@vp/intl`.
- Hover preview after 500 ms: steps through the sprite sheet (`spriteUrl`); timers are cleared on leave and
  unmount.
- Three-dot menu (Radix `DropdownMenu`): Share now; Save to Watch Later and Add to playlist once 73 lands.

## Delivery slices

1. App shell (header, responsive sidebar, search input) replacing `DefaultLayout`; `src/layout` deleted.
2. Video card, category pills and `/` with infinite feed and skeleton; `AllVideosPage` deleted.
3. `/feed/trending` with the redirect; `Trending` deleted.
4. `/feed/subscriptions` and `/feed/channels` with redirects; `Subscriptions` and `SubscriptionVideos` deleted.
5. `/channel/$channelId` with header skeleton; `UserPage` deleted.
6. Card hover preview and three-dot menu.

## Acceptance criteria

- [ ] Shell renders drawer, rail and bottom bar at the breakpoints above, with no layout jump on hydrate.
- [ ] `/` focuses the search input; submitting navigates to `/search?q=<term>`.
- [ ] Every page in the table loads its first page in the route loader; server-rendered HTML contains the
      first cards, and the browser does not refetch them on hydrate.
- [ ] Scrolling a feed loads the next page, prefetched before the sentinel is visible.
- [ ] Selecting a category pill updates `?category=` and the feed; a direct link with `?category=` renders
      filtered on the server.
- [ ] `/trending`, `/subscriptions` and `/subscriptions/videos` redirect to their new URLs.
- [ ] Each page's `pendingComponent` is a skeleton matching the loaded layout.
- [ ] Card shows duration, clamped title, avatar, views and relative date; hover preview starts after 500 ms
      and leaves no timer behind.
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
- Hover preview with fake timers: nothing at 499 ms, preview at 500 ms, cleared on leave.
- Redirects: each old URL as one `it.each` over memory history.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Layout verified on mobile, tablet and wide desktop.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
