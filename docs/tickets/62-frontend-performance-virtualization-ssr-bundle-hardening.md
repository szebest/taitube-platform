# 62: Remove the legacy frontend and virtualize long lists

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#62](https://github.com/szebest/taitube-platform/issues/62) |
| Size | L |
| Blocked by | 56 - Frontend auth · 57 - Production video player · 58 - Modern browse layout · 59 - Modern watch page · 60 - Creator studio · 74 - Multi-resource search UI · 89 - TanStack Start foundation |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

The cleanup ticket after the page rewrites: once 57 to 60 have replaced every legacy page from
[89's table](89-web-tanstack-start-foundation.md#5-legacy-pages-carried-over), the legacy stack goes, and the
long lists get virtualized. SEO is [63](63-tanstack-router-start-ssr-seo-streaming.md); bundle budget and
component-level splitting are [66](66-advanced-code-splitting-dynamic-chunking-lazy-loading.md).

## What to build

1. **Legacy removal.** Delete whatever is left of `apps/web/src/modules/`, the legacy providers and root
   layout pieces, their SCSS, and the dependencies nothing imports any more: `bootstrap`, `react-bootstrap`,
   `sass`, `react-player`. A zero-matches row keeps them out.
2. **List virtualization.** `@tanstack/react-virtual` on the feed grid (window scroller), the comment thread
   and the search results, with dynamic row measurement so infinite queries keep paging as the user scrolls.

## Delivery slices

1. Legacy removal and the zero-matches row.
2. Feed grid virtualization.
3. Comments and search results virtualization.

## Acceptance criteria

- [ ] `apps/web/src/modules/` is gone; `bootstrap`, `react-bootstrap`, `sass` and `react-player` are out of
      `apps/web/package.json`, and a zero-matches row fails on any of them.
- [ ] Feed, comments and search results render a bounded number of rows however many items are loaded (a
      spec with 2,000 items asserts the mounted row count stays under 50).
- [ ] Scrolling to the end of a virtualized list still fetches the next page.

## Testing plan

- Virtualization specs per list with a large fixture, asserting mounted row count and next-page fetch.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:architecture` green.
- [ ] `apps/web/AGENTS.md` no longer mentions the legacy stack.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
