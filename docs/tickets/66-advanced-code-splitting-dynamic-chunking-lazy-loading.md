# 66: Advanced code splitting, granular chunking & asset lazy loading

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#66](https://github.com/szebest/taitube-platform/issues/66) |
| Size | M |
| Blocked by | 57 - Production video player · 60 - Creator studio · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

Route-level splitting is [89](89-web-tanstack-start-foundation.md)'s (the router's automatic splitting). This
ticket keeps the initial load small once the heavy features exist.

## What to build

1. **Bundle budget in CI.** Measure the initial entry chunk (gzip) from the build output and fail CI above
   the budget (start at 120 KB, record the measured value in the PR).
2. **Vendor chunks.** `manualChunks` in the app's Vite config so vendor code caches across deploys:
   React and the TanStack runtime, the player (`@vidstack/react`, `hls.js`), charts.
3. **Component-level lazy loading** for subtrees inside a route that most visits never open: the player
   engine until playback, studio charts, dialogs (share, save to playlist) until opened.
4. **Images.** `loading="lazy"`, `srcset` by DPR, explicit dimensions or `aspect-ratio`, and a low-quality
   placeholder until the poster loads.
5. **Cache headers.** Hashed assets served by the Start server with `Cache-Control: public,
   max-age=31536000, immutable`; the HTML is not.

## Acceptance criteria

- [ ] CI fails when the initial entry chunk exceeds the budget.
- [ ] The build output shows the vendor chunks above and no vendor module duplicated across chunks.
- [ ] The feed route loads no player or chart code; the player chunk loads on the watch page, charts on the
      analytics route, dialogs on open.
- [ ] Poster images are lazy below the fold, carry `srcset` and fixed dimensions.
- [ ] Hashed assets return the immutable header from `pnpm --filter @vp/web start`.

## Out of scope

- Route-level splitting and preload: [89](89-web-tanstack-start-foundation.md).
- Measuring the effect in the field: [64](64-web-vitals-monitoring-inp-lcp-cls-real-user-measurement.md).

## Definition of Done

- [ ] `pnpm --filter @vp/web build` and `pnpm --filter @vp/web test` green; the budget check passes in CI.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
