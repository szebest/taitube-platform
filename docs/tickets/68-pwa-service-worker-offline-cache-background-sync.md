# 68: Progressive Web App (PWA) & Service Worker — offline experience, asset caching & background sync

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#68](https://github.com/szebest/taitube-platform/issues/68) |
| Size | L |
| Blocked by | 53 - Frontend architecture · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

A resilient web platform must feel like an installed native application: launching instantly regardless of network condition, surviving intermittent drops on mobile connections, and permitting offline browse capability.

This ticket delivers a **PWA & Service Worker** (`apps/web/src/sw.ts` via `vite-plugin-pwa` and Workbox, registered in the app's TanStack Start Vite config from [89](89-web-tanstack-start-foundation.md)). The server renders every page, so there is no static `index.html` to fall back to: the service worker precaches a dedicated offline page instead.

1. **Precision Caching Strategies**:
   - **Static App Shell (HTML, JS chunks, CSS, Web Fonts):** `Cache-First` with background cache refresh (`Stale-While-Revalidate`).
   - **Video Posters & Storyboard Sprite Sheets:** `Stale-While-Revalidate` with an LRU cache expiration policy (max 100 entries or 30 days) to prevent device storage bloat.
   - **HLS Playlists (`.m3u8`):** `Network-First` with a 3-second timeout falling back to cached playlists.
   - **Public API Feed (`/v1/feed`, `/v1/categories`):** `Network-First` with cache fallback, allowing users to browse their previously cached feed while offline.
2. **Offline Mode & Offline Video Watchlist UI**:
   - Detects offline status via `navigator.onLine` and renders a clean, animated offline badge.
   - Fallback offline page when attempting to access non-cached routes.
   - "Saved for Offline" capability: caches selected video manifests and initial segment chunks to IndexedDB / CacheStorage so users can play bookmarked videos on an airplane or train.
3. **Background Sync (`sync` & `periodicsync`)**:
   - If a viewer submits a like, dislike, or comment while entering an elevator or subway tunnel, the request is intercepted by the Service Worker and queued in IndexedDB.
   - Uses the Background Sync API (`workbox-background-sync`) to replay queued mutations automatically the moment network connectivity returns.
4. **PWA Manifest & Install Experience**:
   - Full Web App Manifest (`manifest.json`): name `Taitube`, short name, standalone display mode, theme color (`#0f0f0f`), app shortcuts (Home, Subscriptions, Studio).
   - Custom in-app "Install Taitube" banner prompt with dismiss persistence.
   - Periodic update prompt: non-intrusive toast informing the user when a new version of the app is available, with a one-click "Reload to update" action.
5. **Save-data prefetch guard** (from [67](67-intelligent-prefetch-lazy-fetching-service-worker-cache.md)):
   - When `navigator.connection.saveData` is true or `effectiveType` is `2g`/`slow-2g`, intent preload and
     viewport prefetch are switched off (router `defaultPreload` and the feed's next-page prefetch read one
     shared `shouldPrefetch()`).

## Delivery slices

1. Manifest, install prompt, update prompt and the save-data guard.
2. Runtime caching strategies and the offline page.
3. Background sync for reactions and comments.
4. Saved for offline videos.

## Acceptance criteria

- [ ] `vite-plugin-pwa` integrated into the app's Vite config using the `InjectManifest` strategy; the service worker registers on the client only.
- [ ] Web App Manifest configured with complete icon set (192x192, 512x512, maskable icons) and standalone mode.
- [ ] Precision caching verified:
  - App shell and assets load offline on airplane mode.
  - Image posters served from CacheStorage with LRU cleanup.
  - API feed falls back to cached response when network disconnected.
- [ ] Background Sync queue configured for `POST /v1/videos/:id/reactions` and `POST /v1/videos/:id/comments`.
- [ ] Offline notification toast appears when connection drops and disappears on reconnection.
- [ ] Clean update lifecycle: Service Worker does not hijack active playback sessions; prompts user before updating.
- [ ] Local dev bypass: Service Worker automatically bypassed in development mode to preserve Vite HMR.
- [ ] With `saveData` true or a `2g` connection, hovering a link and scrolling the feed trigger no prefetch requests.

## Out of scope

- Push Notifications via WebPush server (can be added as an extension).

## Notes for the implementer

- Avoid caching multi-megabyte `.ts` video segments unconditionally in the default cache to prevent blowing browser storage quotas.
- Use `workbox-routing` and `workbox-strategies` for modular strategy definitions.

## Testing plan

- Offline test: Load app, enable Chrome DevTools 'Offline' mode, navigate to previously loaded video, verify page and cached poster load without network error.
- Background sync test: Queue comment while offline, switch network to online, assert comment is delivered to backend and appears in the thread.
- Save-data test: mock `navigator.connection.saveData = true`, hover a link, assert no loader request.

## Definition of Done

- [ ] Browser devtools report the app as installable (manifest and service worker valid).
- [ ] `pnpm --filter @vp/web build` and `pnpm --filter @vp/web test` compiles the Service Worker cleanly.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
