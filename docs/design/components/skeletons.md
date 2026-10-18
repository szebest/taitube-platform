# Skeletons

The loading layout of the `@vp/components` components, at the loaded layout's exact dimensions, so a `pendingComponent` shifts nothing when data arrives. It carries no signature move: it honours the polish bar's CLS under 0.05.

## The rule

**Each component owns its skeleton.** A component's folder exports `<Name>Skeleton` next to it, built from the same parts, spacing roles and sizing tokens as the loaded layout, so the two cannot drift. A skeleton is never written in a page, and never in a different package from its component:

- the shared components' skeletons live in `@vp/components` and are specified here;
- a web kit component's skeleton is in that component's web spec ([apps/web/](../apps/web/README.md)), and a studio kit component's in a Skeleton section of its studio spec ([apps/studio/](../apps/studio/README.md));
- a skeleton that composes components from a lower layer (a `ShelfSkeleton` of five `VideoCardSkeleton`s) uses their skeletons, never a copy of their CSS.

## Anatomy

```
 VideoThumbnailSkeleton (landscape)
 ┌──────────────────────────┐
 │ 1 frame block 16:9       │
 │                          │
 └──────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Block | `Skeleton`: `tint` to `tint-strong` shimmer, radius by the role of what it stands for (`thumb`, `card`, `chip`, `xs`) |
| 2 | Text bars | height equals the line box of the type style (table below), width as a percentage of the loaded column |
| 3 | Repeated item | skeleton lists render the loaded count where known, otherwise the viewport's count |

## Props

Plus the standard props. A skeleton takes only what changes its dimensions, mirrored from its component.

```ts
// types.ts (VideoThumbnailSkeleton; each skeleton re-exports its component's own alias)
import type { VideoThumbnailAspect } from '../video-thumbnail/types';

export type VideoThumbnailSkeletonAspect = VideoThumbnailAspect;
```

```ts
interface VideoThumbnailSkeletonProps {
  aspect?: VideoThumbnailSkeletonAspect;
}
interface PageHeaderSkeletonProps {
  titleStyle?: PageHeaderTitleStyle; // from page-header/types.ts
}
```

There are no copy props: a skeleton has no text. A list skeleton's count is a prop of the app's list skeleton, not of these.

## Dimensions

Heights are line boxes of the type styles at the default `fontSize` set: `title` 22 px, `body-sm` 20 px, `overline` 13 px, `caption` 16 px, `title-lg` 28 px, `headline` 37 px, `display` 50 px, `body` 23 px. Sizes follow the active sizing and spacing sets; the px below are the `medium` sizing and `default` spacing values, for reading only.

| Skeleton | Dimensions |
|---|---|
| `VideoThumbnailSkeleton` `landscape` | block 100 % wide, 16:9, radius `thumb`; height = width x 9/16 |
| `VideoThumbnailSkeleton` `portrait` | block 100 % wide, 9:16, radius `thumb` |
| `PageHeaderSkeleton` | title bar 240 by 37 px (28 px at compact spacing, 50 px for `display`), description bar 380 by 23 px |

`EmptyState`, `ErrorState` and `SectionError` have no skeleton: they replace one. `SectionError` keeps the section's own skeleton on screen during a retry ([section-error](section-error.md)).

## States

| State | What changes |
|---|---|
| shimmer | `tint` to `tint-strong` gradient sweep over the motion set's shimmer duration, linear, starts only after a 150 ms delay so a fast response never flashes |
| settled | the skeleton is replaced, not faded: the real content has the same height, so nothing moves |
| long wait | after 8 s the app may swap in a [SectionError](section-error.md) or [ErrorState](error-state.md); the skeleton does not change |
| more contrast | the shimmer is replaced by a static `tint-strong` block with a `border-strong` outline at the control width |
| reduced motion | static `tint` block, no sweep (the `reduced` motion set) |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | the widths and counts of the compact layout: `avatar.md` comment avatars, `title-lg` header |
| medium | `avatar.lg` |
| expanded | as medium |
| large | up to the fluid maximum |

Skeleton lists use the same grid or column component as the loaded list, so the column count matches at every width.

## Motion

- Shimmer: the `tt-shimmer` sweep, the one looped animation in the system.
- No enter or exit transitions: the swap is a cut.
- Reduced motion: no sweep, static ground.

## Accessibility

- A skeleton region is `aria-hidden="true"`; its parent carries `aria-busy="true"` and a visually hidden "Loading" text node (`useUiCopy()`) announced once through a polite live region.
- Skeletons are not focusable and are skipped by Tab.
- Shimmer never carries meaning on its own, and it is off under more contrast and reduced motion.
- The pending skeleton and the loaded layout have the same landmark structure, so focus and reading position survive the swap.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on the skeleton root |
| A skeleton for an app component that composes shared ones | use the shared skeletons as children; add the app's own bars with the `Skeleton` primitive |
| A different bar | `tv({ extend: skeletonStyles })`, or the `Skeleton` primitive's own props |

## Composition

`Skeleton` primitive only, composed per component.

## Used by

- [71, skeleton and shimmer loading states](../../tickets/71-frontend-skeleton-shimmer-loading-states.md)
- every page ticket's `pendingComponent`, in both apps

## Workbench stories

- Every shared skeleton beside its loaded component at the same width (a layout-shift check)
- VideoThumbnail in landscape and portrait
- PageHeader at headline and display
- More contrast
- Reduced motion
- RTL
