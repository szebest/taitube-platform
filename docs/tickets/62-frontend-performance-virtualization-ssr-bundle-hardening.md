# 62: Frontend performance, list virtualization & production bundle hardening

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#62](https://github.com/szebest/taitube-platform/issues/62) |
| Size | L |
| Blocked by | 57, 58, 59, 60, 61 |
| Blocks | 63, 64, 66, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

High-traffic streaming frontends face severe client-side performance hurdles: DOM node explosion from infinite feeds and thousands of comments, heavy player bundle sizes, lack of video SEO metadata (OpenGraph/Twitter Cards), and slow initial bundle load times.

This ticket delivers production performance engineering and bundle hardening for `apps/web`:
1. **List Virtualization with TanStack Virtual (`@tanstack/react-virtual` v3)**:
   - Virtualizes the public video feed grid, playlist drawer, search results, and heavy comment threads.
   - Dynamic element measurement with `useVirtualizer`, allowing smooth 60fps scrolling across 10,000+ items with constant DOM node count (< 40 DOM nodes in viewport).
   - Window scrolling integration (`getScrollElement: () => window`) for the home feed and dedicated container virtualization for the comments thread.
2. **TanStack Start Streaming SSR & Bundle Chunk Splitting**:
   - Leverage TanStack Start code-splitting and `React.lazy` for heavy modules: `<TaitubePlayer />` (Vidstack + HLS.js), Creator Studio chart libraries (Recharts), and Admin panel modules.
   - Initial entry bundle kept below 150 KB (gzip).
3. **OpenGraph & Video SEO Meta Tags (TanStack Start Head)**:
   - Dynamic meta tags generation for video pages (`og:title`, `og:description`, `og:image` poster, `og:video` HLS stream URL, and JSON-LD schema `VideoObject` structured data via TanStack Start `head` functions).
4. **Image & Poster Optimization**:
   - Modern `srcset` responsive poster images with WebP fallback and blur placeholder skeletons during loading.
5. **Lighthouse Audit & Core Web Vitals**:
   - Lighthouse performance score >= 90 on Desktop and Mobile.
   - Cumulative Layout Shift (CLS) < 0.05, Largest Contentful Paint (LCP) < 1.8s.

## Acceptance criteria

- [ ] `@tanstack/react-virtual` v3 integrated into home feed, search results, and video comments list.
- [ ] DOM node count remains strictly under 50 nodes even when browsing feeds with 2,000+ videos.
- [ ] Code splitting configured: `HlsPlayer`, `StudioDashboard`, and `AdminPanel` load in separate async chunks.
- [ ] Initial bundle analyzer report verifies main JS bundle is under 150 KB gzipped.
- [ ] Video detail page outputs complete OpenGraph meta tags and JSON-LD `VideoObject` structured data via TanStack Start SSR.
- [ ] Skeleton loading states implemented for video cards, channel headers, and comment sections to prevent layout shift.
- [ ] Lighthouse audit passes with >= 90 score across Performance, Accessibility, Best Practices, and SEO.

## Out of scope

- Native iOS/Android apps.

## Notes for the implementer

- Run `pnpm --filter @taitube/web build --analyze` or `rollup-plugin-visualizer` to audit chunk sizes.
- Ensure all images have explicit `aspect-ratio` or `width`/`height` attributes to guarantee zero CLS.

## Testing plan

- Virtualization test: Seed 2,000 comments, scroll to bottom, inspect browser DOM to verify fewer than 50 comment DOM nodes exist simultaneously.
- SEO test: Fetch video page with headless crawler / curl and assert valid `VideoObject` JSON-LD schema.

## Definition of Done

- [ ] Lighthouse CI audit scores >= 90 on all metrics.
- [ ] `pnpm --filter @taitube/web build` succeeds with zero bundle size warnings.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
