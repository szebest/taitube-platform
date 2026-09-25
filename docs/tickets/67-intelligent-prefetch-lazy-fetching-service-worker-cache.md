# 67: Intelligent pre-fetching, viewport-triggered queries & Service Worker asset cache

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#67](https://github.com/szebest/taitube-platform/issues/67) |
| Size | M |
| Blocked by | None - absorbed into 89, 58, 59 and 68 |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** done

## Absorbed

[89](89-web-tanstack-start-foundation.md) moved the frontend to TanStack Start, which made this ticket a set of
small pieces that each belong to the ticket already touching that code:

- Intent preload on links: [89](89-web-tanstack-start-foundation.md) sets `defaultPreload: 'intent'` on the router.
- Comments query deferred until the section is in view: [59](59-video-watch-page-responsive-layout-enhancements.md), which builds the watch page.
- Next-page prefetch on the infinite feed: [58](58-modern-browse-layout-microinteractions-motion.md), which builds the feed.
- Service worker caching and the save-data / slow-connection prefetch guard: [68](68-pwa-service-worker-offline-cache-background-sync.md), which owns the service worker.
