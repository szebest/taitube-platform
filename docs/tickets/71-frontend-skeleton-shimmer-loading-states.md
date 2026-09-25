# 71: Frontend skeleton shimmer loading states — layout-stable placeholders for primary views (CLS < 0.05)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#71](https://github.com/szebest/taitube-platform/issues/71) |
| Size | M |
| Blocked by | None - absorbed into 55, 89, 58, 59, 60 and 64 |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §13 Observability](../SDD.md#13-autoscaling--observability) |

**Status:** done

## Absorbed

With route `pendingComponent`s from [89](89-web-tanstack-start-foundation.md), a skeleton is part of the page
that shows it, so this ticket's scope went to the tickets building those pages:

- `Skeleton` primitive and the reduced-motion fallback: [55](55-design-system-tailwind-radix-dark-theme.md).
- Pending delay so fast navigations never flash a skeleton: [89](89-web-tanstack-start-foundation.md).
- Video grid and channel header skeletons as route `pendingComponent`: [58](58-modern-browse-layout-microinteractions-motion.md).
- Watch page skeleton: [59](59-video-watch-page-responsive-layout-enhancements.md).
- Studio table skeleton: [60](60-creator-studio-dashboard-video-management-ui.md).
- CLS measurement: [64](64-web-vitals-monitoring-inp-lcp-cls-real-user-measurement.md).
