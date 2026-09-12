# 66: Advanced code splitting, granular chunking & asset lazy loading

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#66](https://github.com/szebest/taitube-platform/issues/66) |
| Size | M |
| Blocked by | 62 — Frontend performance · 63 — TanStack Router SSR |
| Blocks | 67, 68, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

## What to build

A large video streaming platform bundles numerous heavy libraries: HLS.js, charting engines (Recharts), markdown editors, and administrative tables. If loaded synchronously in a single bundle, users on 3G/4G connections experience multi-second blank screens.

This ticket implements an aggressive, production-grade **Code Splitting & Lazy Loading Strategy** for `apps/web`:

1. **Route-Level Code Splitting via TanStack Router**:
   - Every major route (`/`, `/watch/$videoId`, `/studio/*`, `/admin/*`) splits into an isolated asynchronous chunk loaded on-demand.
   - Initial entry bundle (main vendor + shared runtime) strictly capped under **120 KB** (gzip).
2. **Granular Component-Level Dynamic Imports**:
   - `lazy()` import for heavy subtrees:
     - **Vidstack Player & HLS.js engine:** Only fetched on `/watch` or when playing a preview, keeping the home feed lightning fast.
     - **Creator Studio Analytics & Recharts:** Kept out of standard user bundles; only loaded when navigating to `/studio`.
     - **Share / Playlist Modals:** Only loaded upon user click.
3. **Smart Asset & Media Lazy Loading**:
   - Native `loading="lazy"` + `IntersectionObserver` on all video poster cards.
   - Responsive `srcset` providing thumbnail sizes tailored to device DPR (1x, 2x, mobile).
   - BlurHash / low-quality image placeholder (LQIP) displayed until the high-res poster resolves, preventing layout flash.
4. **Vite 6 Rollup Chunk Optimization**:
   - Configures `manualChunks` in `vite.config.ts`:
     - `vendor-react`: `react`, `react-dom`, `@tanstack/react-router`.
     - `vendor-query`: `@tanstack/react-query`.
     - `vendor-player`: `@vidstack/react`, `hls.js`.
     - `vendor-charts`: `recharts` / `d3`.
   - Long-term immutable caching: content hashes in filenames (`[name].[hash].js`) cached with `Cache-Control: public, max-age=31536000, immutable`.

## Acceptance criteria

- [ ] Vite 6 chunking configured in `vite.config.ts` separating vendor libraries into deterministic, cached chunks.
- [ ] Route-based code splitting enforced across all TanStack Router routes.
- [ ] Component lazy loading implemented for `<TaitubePlayer />`, Studio charts, and modal dialogs.
- [ ] Initial critical JavaScript bundle verified <= 120 KB gzipped via `rollup-plugin-visualizer`.
- [ ] IntersectionObserver lazy loading on video card posters with responsive `srcset` and BlurHash placeholders.
- [ ] Static assets configured with `immutable` cache headers in production server/CDN profile.
- [ ] Automated bundle budget CI test: Fails if the initial entry chunk exceeds 120 KB gzipped.

## Out of scope

- Dynamic WebAssembly decoding.

## Notes for the implementer

- Use `React.lazy` or TanStack Router's native `lazyRouteComponent` for clean suspense fallback boundaries.
- Ensure skeleton placeholders have identical dimensions to the lazily loaded components to prevent layout shift.

## Testing plan

- Bundle visualizer test: Generate visualizer HTML report, inspect chunk boundaries and assert zero duplicate vendor inclusions.
- Network throttling test: Simulate Fast 3G, navigate to home feed, verify initial script transfers under 120 KB.

## Definition of Done

- [ ] Bundle budget assertion passes in CI.
- [ ] `pnpm --filter @taitube/web build` outputs clean, balanced chunks.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
