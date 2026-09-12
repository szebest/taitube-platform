# 71: Frontend skeleton shimmer loading states — layout-stable placeholders for primary views (CLS < 0.05)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 55 — Modern design system foundation · 58 — Modern browse layout · 59 — Modern video watch page |
| Blocks | 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §13 Observability](../SDD.md#13-autoscaling-observability) |

**Status:** blocked

## What to build

Content loading should feel instant, calm, and seamless. Without loading placeholders, pages jump violently as video thumbnails, player elements, and comments mount, triggering severe Cumulative Layout Shift (CLS) that damages user experience and Core Web Vitals rankings. Conversely, overusing skeletons on every tiny badge or button creates visual jitter and skeleton fatigue.

This ticket delivers a **Disciplined Skeleton Loading Architecture ("Essential Places Only")**:

1. **Targeted Primary Viewport Surfaces**:
   - Skeletons are strictly restricted to the four most impactful initial-load surfaces:
     1. **Video Grid Skeleton (`<VideoGridSkeleton count={8} />`):** Used for the Home browse feed, Category feeds, Subscribed channel feeds, and Search results. Features a responsive CSS grid of 16:9 video thumbnail placeholders, avatar circle, 2 lines of title/channel metadata matching exact typography leading, and relative timestamp pill.
     2. **Watch Page Skeleton (`<WatchPageSkeleton />`):** Displays a 16:9 obsidian placeholder for `<TaitubePlayer />`, interactive action bar pill placeholders (like/dislike, share, download), creator channel header, and top 3 comments placeholders.
     3. **Channel Profile Skeleton (`<ChannelHeaderSkeleton />`):** Displays wide banner placeholder (16:3 aspect ratio), 80px channel avatar circle overlay, channel handle/subscriber count lines, and tab bar pill placeholders.
     4. **Creator Studio Table Skeleton (`<StudioTableSkeleton rows={5} />`):** Displays compact video management table rows with 16:9 miniature thumbnail, title, status pill, visibility badge, and date placeholders.

2. **Strict Layout Stability (CLS < 0.05)**:
   - Skeletons must mirror the exact dimensions, aspect ratios, margins, padding, and font line heights of their corresponding loaded components.
   - When asynchronous TanStack Query data arrives, the replacement swap occurs with zero pixel displacement, guaranteeing Core Web Vitals `CLS < 0.05`.

3. **Obsidian Shimmer Aesthetics & Motion Safety**:
   - Built on Tailwind CSS v4 and Radix UI primitive foundations (`apps/web/src/components/ui/skeleton.tsx`).
   - Dark theme obsidian design: uses a subtle dark zinc base (`bg-zinc-800/80`) swept by a soft linear gradient highlight (`via-zinc-700/40`) animating smoothly across a 1.5-second loop.
   - **Reduced Motion Support:** Respects `prefers-reduced-motion: reduce` by disabling the continuous linear shimmer transform and using a calm, static semi-translucent fill.

4. **Flicker-Free Pending Threshold**:
   - Integrated with TanStack Router pending component delay (150ms debounce threshold).
   - If a query resolves within 150ms (such as cached navigation or pre-fetched data), the skeleton is skipped entirely, avoiding annoying 20ms flashes.

## Acceptance criteria

- [ ] Reusable `<Skeleton />` primitive created in `apps/web/src/components/ui/skeleton.tsx` with customizable className, obsidian dark theme styling, and `prefers-reduced-motion` override.
- [ ] `<VideoGridSkeleton count={8} />` implemented in `apps/web/src/components/skeletons/video-grid-skeleton.tsx` with responsive grid matching `<VideoCard />` geometry.
- [ ] `<WatchPageSkeleton />` implemented in `apps/web/src/components/skeletons/watch-page-skeleton.tsx` matching `<TaitubePlayer />` 16:9 ratio and watch layout.
- [ ] `<ChannelHeaderSkeleton />` implemented in `apps/web/src/components/skeletons/channel-header-skeleton.tsx`.
- [ ] `<StudioTableSkeleton rows={5} />` implemented in `apps/web/src/components/skeletons/studio-table-skeleton.tsx`.
- [ ] Automated layout stability test verifying zero height/width discrepancy between skeleton containers and hydrated component containers.
- [ ] Pending threshold delay (150ms) configured in TanStack Router routes preventing skeleton flashes on fast cache hits.
- [ ] Vitest integration tests in `apps/web/src/__tests__/skeletons.integration.test.tsx` verifying DOM output, accessibility attributes (`aria-busy="true"`), and reduced-motion fallback.

## Out of scope

- Micro-skeletons on small interactive widgets, search dropdown chips, or individual like button pills.
- Infinite scroll virtualization skeletons beyond the visible viewport.

## Notes for the implementer

- **Aspect Ratio Utilities:** Use Tailwind's `aspect-video` (16:9) and `aspect-[16/3]` to guarantee identical container dimensions before images or player iframes mount.
- **Accessibility:** Ensure skeleton wrapper elements expose `role="status"` and `aria-label="Loading content..."` while marking child placeholders `aria-hidden="true"`.
- **File Length Discipline:** Keep each skeleton component file <= 250 lines.

## Testing plan

- Dimension matching test: Mount skeleton and mounted card in JSDOM/Testing Library; assert bounding dimensions match.
- Media query test: Emulate `prefers-reduced-motion` and assert CSS animation class is disabled.
- Integration test: Verify pending state displays skeleton when network response is delayed > 150ms.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test` (or `pnpm test`).
- [ ] Architectural docs updated (`ARCHITECTURE.md`, `docs/SDD.md`).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
