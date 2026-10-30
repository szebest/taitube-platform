# StartHereShelf

Location: `apps/client/web/src/components/channel/start-here-shelf/`. Web's app kit, presentational and compound, built on [Shelf](shelf.md) and [VideoCard](video-card.md) (`shelf`).

The shelf at the top of a channel's Home tab that tells a newcomer where to begin: the creator's pinned videos, or the channel's most-viewed uploads when none are pinned. It carries the "Start here shelf" signature move, with About as a manifesto in the serif.

## Anatomy

```
 1 START HERE
 2 New here? Begin with these three.        (editorial, creator's words)
 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───▒▒
 │ 3  1   │ │   2    │ │   3    │ │   4    │ │
 └────────┘ └────────┘ └────────┘ └────────┘ └───▒▒
 4 Pinned by Marta Reis                       5 See all videos
```

| # | Part | Notes |
|---|---|---|
| 1 | `Kicker` | `overline`, `accent-ink`; the copy depends on `source` |
| 2 | `Note` | optional creator line in `editorial`, one or two lines |
| 3 | items | `shelf` cards; numbered in `mono` over the thumbnail corner when the order is the creator's |
| 4 | `Attribution` | `caption`, `fg-muted` |
| 5 | See all | link slot to the Videos tab |

## Props

```ts
// types.ts
import type { PublicFeedSort } from '@vp/domain';

export type StartHereSource = 'pinned' | Extract<PublicFeedSort, 'popular'>;
```

```ts
interface StartHereShelfRootProps {
  source: StartHereSource;
  onEndReached?: () => void;
}
```

Items are the Shelf's children (`Shelf.Item`). The wrapper builds the list from the creator's pins once [ticket 96](../../../tickets/96-channel-featured-videos-start-here.md) ships, and from the channel's most-viewed uploads before that and for channels that pin none; the kit never decides which. `source` drives only copy and numbering: `pinned` reads "Start here", allows the note and numbers cards in the creator's order; `popular` reads "Most watched" with no note or numbers. The attribution derives from `source`.

## Variants

| Source | Difference |
|---|---|
| `pinned` | kicker "Start here", note and numbering allowed, attribution "Pinned by the creator" |
| `popular` | plain heading, no note, no numbering, attribution "Most viewed" |

## States

| State | What changes |
|---|---|
| fewer than three | cards left aligned, no chevrons or fade |
| single item | laid out wide as a `spotlight` card (the wrapper passes one item) |
| empty | nothing renders; the Home tab shows [EmptyState](../../components/empty-state.md) instead |
| error | [SectionError](../../components/section-error.md) in the track area, heading stays |
| loading more | as [Shelf](shelf.md) |

## Responsive behaviour

Compact: swipe with a peeking card, numbering overlay 20 px, note two lines. Medium: chevrons on pointer, 2.3 cards. Expanded: 3.3. Large: 4.3; the note stops at 68 ch.

## Skeleton

`StartHereShelfSkeleton`: kicker bar 88 by 13, note bar 320 by 28, five shelf `VideoCardSkeleton`s at `gap-shelf`. Rules in [skeletons](../../components/skeletons.md).

## Motion

All motion is the Shelf's: chevron fade `fast`, scroll `slow` with `settle`. Numbers do not animate.

## Accessibility

- A `section` labelled by the heading; the track is an `ol` when numbered, so the creator's order is exposed, and a `ul` otherwise.
- Attribution is text, not a tooltip. Everything else matches the Shelf.
- The note is the creator's content, treated as data, never markup.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Kicker` and `Attribution`.
- `useStartHereShelf()` returns `{ source, numbered }`, so an app-local item part can draw its own number.
- `tv({ extend: startHereShelfStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `ChannelStartHere` | `channels/components/` | `channelId: string` | `useChannelFeatured(channelId)` (96), `useChannelVideos(channelId, { sort: 'popular' })`, `useFormat`, `useT` |

It picks `pinned` when the channel has pins and `popular` otherwise, and renders `FeedVideoCard` items.

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) the channel Home tab with the popular fallback; [96](../../../tickets/96-channel-featured-videos-start-here.md) fills it with the creator's pins.

## Workbench stories

Pinned, numbered, with a note; popular fallback; two items; single item as spotlight; long note; error; compact swipe; RTL; skeleton.
