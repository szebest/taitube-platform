# Shelf

Location: `apps/client/web/src/components/discovery/shelf/`. Web's app kit, presentational and compound, built from `@vp/ui` primitives (`IconButton`, `ScrollArea`).

A headed horizontal scroller of cards with an edge fade, chevrons and snap. It carries curated-before-infinite: every shelf has a heading that says why it is there, and Home is a stack of them.

## Anatomy

```
 1 From channels you follow            2 Curated note            3 See all >
 4 [<]  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐▒▒  [>] 5
        │ card  │ │ card  │ │ card  │ │ card  │ │ card  │▒▒
        └───────┘ └───────┘ └───────┘ └───────┘ └───────┘▒▒
```

| # | Part | Notes |
|---|---|---|
| 1 | `Header` title | `title-lg`, an `h2`, carries the reason |
| 2 | `Header` note | optional curator line in `editorial`, one line, `fg-muted` |
| 3 | `Header` action | a link slot at the end of the heading row |
| 4, 5 | `Chevron` | `IconButton` over each edge, pointer devices, hidden at the ends |
| 6 | `Item` track | `grid-auto-flow: column`, scroll snap, `gap-shelf`, 48 px edge fade mask |

## Props

```ts
// types.ts
import type { Side } from '@vp/ui';

export type ShelfVariant = 'card' | 'poster' | 'channel';
export type ShelfChevronSide = Extract<Side, 'inline-start' | 'inline-end'>;
```

```ts
interface ShelfRootProps {
  variant?: ShelfVariant;
  onEndReached?: () => void;
}
```

`Shelf.Header` renders the heading element it is given, so there is no level prop. Loading more is a trailing skeleton item; empty and error are the wrapper rendering [EmptyState](../../components/empty-state.md) or [SectionError](../../components/section-error.md) in place of the items. Chevron and region labels come from `useUiCopy()`.

## Variants

| Variant | Track column width |
|---|---|
| `card` | `minmax(260px, 1fr)`, 16:9 cards |
| `poster` | `minmax(160px, 180px)`, 9:16 |
| `channel` | 140 px avatar-led tiles |

## States

| State | What changes |
|---|---|
| hover or focus within | chevrons fade in at `fast` |
| at start or end | that chevron leaves the tab order and the mask on that side drops |
| loading more | a trailing skeleton card, `aria-busy` on the track |
| empty, error | replaces the track, the heading stays |
| fewer items than fit | no chevrons or mask, cards left aligned |

## Responsive behaviour

Compact: swipe only, the next card peeks 24 px, gutter `gutter-compact`, snap start. Medium: chevrons on pointer, 2.3 cards. Expanded: 3.3 to 4.3. Large: 4.3 to 6.3; the track runs to the content edge while the heading stays in the gutter.

## Skeleton

`ShelfSkeleton`: heading bar 240 by 28 px (`title-lg` line box), 16 px gap (`gap-stack`), five shelf `VideoCardSkeleton`s at `gap-shelf`; for `poster`, five poster skeletons. Rules in [skeletons](../../components/skeletons.md).

## Motion

A chevron press scrolls 80 % of the visible width, `smooth`, `slow` with `settle`. Chevron fade `fast`. Arrow-key scroll is instant. Reduced motion: jumps without easing.

## Accessibility

- A `section` labelled by its heading; the track is `role="region"` with a label, `tabindex="0"`.
- Left and Right scroll the track, Home and End jump; Tab walks cards and `scroll-padding` keeps the focused one fully visible.
- Chevrons are labelled buttons, out of the tab order on touch. Loading more announces nothing. RTL mirrors track, chevrons and fade.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Header` (its action slot takes a router `Link`).
- `useShelf()` returns `{ variant, atStart, atEnd, scrollBy }` for an app-local control.
- `tv({ extend: shelfStyles, variants: { ... } })` for a local variant.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `ReasonShelf` | `browse/components/` | `reason: ShelfReason` | `useFeedShelf(reason)`, `useT` |
| `ContinueWatchingShelf` | `browse/components/` | none | `useWatchHistory`, `useT` |
| `ShortsShelf` | `browse/components/` | none | `useShortsFeed`, `useT` |
| `LiveNowShelf` | `browse/components/` | none | `useLiveStreams`, `useT` |
| `FollowedChannelsShelf` | `library/components/` | none | `useSubscriptions`, `useT` |

Each fixes `variant`, builds the heading from the reason, and renders `FeedVideoCard` or `ShortPosterCard` items.

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) Continue watching, reason shelves, Shorts, Live now; [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) the You hub.

## Workbench stories

Five cards with reasons; note and See all; poster shelf; channel tiles; chevron states at start, middle, end; fewer items than fit; loading more; empty; error; compact swipe; RTL.
