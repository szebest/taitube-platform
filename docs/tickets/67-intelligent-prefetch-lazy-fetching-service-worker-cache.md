# 67: Intelligent pre-fetching, viewport-triggered queries & Service Worker asset cache

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 53 — Frontend architecture · 66 — Advanced code splitting |
| Blocks | 75 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

## What to build

The perception of speed on platforms like YouTube comes from anticipating the user's next action before they take it. Waiting for a user to click a video before initiating network requests introduces a noticeable 300–600ms latency gap.

This ticket delivers **Intelligent Pre-Fetching, Lazy Fetching & Service Worker Caching**:

1. **Hover & Intent-Driven Route & Data Pre-Fetching**:
   - Integrates TanStack Router's built-in `preload: 'intent'` on all `<Link>` components:
     - When the user hovers over a video card or tab for > 60ms, the router starts fetching the route bundle and invokes the route loader (`useVideoQuery` pre-fetch).
     - By the time the click event registers, the video metadata is already in memory; navigation feels instantaneous (< 10ms perceived latency).
2. **Viewport-Triggered Lazy Fetching**:
   - Comments section lazy fetching: The heavy comment thread query (`useComments(videoId)`) does not execute on initial page load; it only fires when the user scrolls down and the comment section enters the viewport (via `IntersectionObserver`).
   - Infinite scroll threshold pre-fetching: Automatically triggers `fetchNextPage()` on the public feed when the user is 3 rows away from the bottom of the viewport.
3. **PWA Service Worker & Cache-First Strategy**:
   - Lightweight Service Worker built with **Workbox** or native SW:
     - **Static Assets (JS/CSS/Fonts):** Cache-First with background revalidation.
     - **HLS Segment Manifests (`.m3u8`):** Network-first with short cache fallback.
     - **Video Posters & Thumbnails:** Stale-While-Revalidate with maximum cache cap of 100 MB.
4. **Network-Aware Throttling Guard**:
   - Uses `navigator.connection.saveData` and `navigator.connection.effectiveType`:
     - Disables heavy prefetching if the user is on a `2g` connection or has "Data Saver" enabled in their browser.

## Acceptance criteria

- [ ] TanStack Router configured with `preload: 'intent'` and hover delay of 60ms across all navigation links.
- [ ] Video comments query lazy-loaded only when comment section scrolls into the viewport.
- [ ] Feed infinite query triggers `fetchNextPage()` when scrolling within 800px of the page bottom.
- [ ] Workbox / custom Service Worker registered caching static assets and image thumbnails offline.
- [ ] Network-aware prefetch guard: suppresses prefetching when `saveData === true` or connection is `2g`/`slow-2g`.
- [ ] Perceived navigation latency test: Clicking a hovered video card mounts the watch page with data in < 30ms.

## Out of scope

- Full offline video playback of multi-gigabyte HLS streams (deferred to mobile PWA sync).

## Notes for the implementer

- Do not pre-fetch full video TS segments on hover, only route chunks, metadata, and the first manifest chunk.
- Ensure the Service Worker unregisters cleanly during development mode to prevent stale HMR caching issues.

## Testing plan

- Hover prefetch test: Hover over video card in test, assert network request for video details initiates prior to click.
- Data saver test: Mock `navigator.connection.saveData = true`, hover over link, assert pre-fetch request is suppressed.

## Definition of Done

- [ ] Service Worker and prefetch tests green under `pnpm --filter @taitube/web test`.
- [ ] Instantaneous page transitions verified in browser profiling.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
