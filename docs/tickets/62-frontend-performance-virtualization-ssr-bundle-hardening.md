# 62: Remove the legacy frontend and virtualize long lists

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#62](https://github.com/szebest/taitube-platform/issues/62) |
| Size | L |
| Blocked by | 56 - Frontend auth · 57 - Production video player · 58 - Modern browse layout · 59 - Modern watch page · 60 - Creator studio · 74 - Multi-resource search UI · 89 - TanStack Start foundation · 91 - Web import aliases · 95 - Design system 2 |
| Blocks | 111, 131 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** ready

The cleanup ticket after the page rewrites: once 57 to 60 have replaced every legacy page from
[89's table](89-web-tanstack-start-foundation.md#5-legacy-pages-carried-over), the legacy stack goes, and the
long lists get virtualized. SEO is [63](63-tanstack-router-start-ssr-seo-streaming.md); bundle budget and
component-level splitting are [66](66-advanced-code-splitting-dynamic-chunking-lazy-loading.md).

## What to build

1. **Legacy removal.** Delete whatever is left of `apps/client/web/src/modules/`, the legacy providers and root
   layout pieces, `apps/client/web/src/styles/` and every other `.scss`,
   `packages/client/forms/src/**/file-field.module.css`, the legacy `--grayscale-*` variables, and the dependencies nothing imports any more: `bootstrap`,
   `react-bootstrap`, `bootstrap-icons`, `sass`, `react-player`, `react-pro-sidebar`, `react-toastify`,
   `react-horizontal-scrolling-menu`. A zero-matches row keeps them out.
   With Bootstrap gone, drop the `tw:` prefix [55](55-design-system-tailwind-radix-dark-theme.md) put on
   Tailwind (it only exists so Bootstrap's `!important` utilities such as `p-3` or `rounded` cannot
   override ours): `prefix(tw)` and `@layer theme` out of `@vp/ui`'s stylesheet, `@import "tailwindcss"` with
   its preflight instead, and `cn` back to plain `twMerge`. The `tw:` strip is a codemod: a script in the PR,
   run once over `apps/client/*/src` and `packages/client/*/src`, so the change is mechanical and reviewable
   by rerunning it.
   [95](95-design-system-2.md)'s "no new stylesheets" allowlist (section 9) goes to empty here, and the
   architecture row then holds the count of `.scss` and `.module.css` files at zero.
2. **List virtualization.** `@tanstack/react-virtual` on the feed grid (window scroller), the comment thread
   and the search results, with dynamic row measurement so infinite queries keep paging as the user scrolls.
   Rows stay web's `VideoCard` and `CommentItem` from 95; the virtualizer only positions them.

## Delivery slices

1. Legacy removal and the zero-matches row.
2. Feed grid virtualization.
3. Comments and search results virtualization.

## Acceptance criteria

- [ ] `apps/client/web/src/modules/` and `apps/client/web/src/styles/` are gone; every dependency in the removal
      list is out of every `package.json`, and a zero-matches row fails on any of them.
- [ ] No `--grayscale-*` variable and no `tw:` prefix left in `apps/client/*/src` or `packages/client/*/src`;
      the codemod script is in the PR; Tailwind's preflight is on.
- [ ] 95's stylesheet allowlist is empty and the architecture row fails a fixture that adds one `.scss` or
      `.module.css` file.
- [ ] A `@vp/workbench` baseline the preflight moves is updated in the same PR with its diff shown; the
      Playwright run of `/`, `/watch/<id>` and the studio's `/videos` keeps CLS under 0.05.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] Feed, comments and search results render a bounded number of rows however many items are loaded (a
      spec with 2,000 items asserts the mounted row count stays under 50).
- [ ] Scrolling to the end of a virtualized list still fetches the next page.

## Testing plan

- Virtualization specs per list with a large fixture, asserting mounted row count and next-page fetch.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:architecture` green.
- [ ] `apps/client/web/AGENTS.md` no longer mentions the legacy stack.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
