# ChannelSpotlight

Location: `apps/client/web/src/components/channel/channel-spotlight/`. Web's app kit, presentational and compound, built from [VideoCard](video-card.md) (`spotlight`) and `Button`.

The block a channel page opens with, above Home's content: the channel's trailer for a newcomer, the video the creator keeps for subscribers who come back for anyone subscribed. It is the only part of the page that depends on who is looking, so it is fetched apart from the channel and the rest of the page stays cacheable.

## Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌───────────────────────────────┐   1 CHANNEL TRAILER                 │
│ │      3 thumbnail              │   2 Marta Reis Films in two minutes │
│ │                         2:04  │   ● MARTA REIS FILMS · 86K views    │
│ └───────────────────────────────┘   [ 4 Watch ]                       │
└──────────────────────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Kicker` | `overline`, `accent-ink`; "Channel trailer" or "Welcome back", a finished string from the wrapper |
| 2 | title | the card's `Title`: `headline` on expanded and up, `title-lg` below |
| 3 | thumbnail | the card's `Thumb`, radius `thumb`, up to 640 px |
| 4 | `Actions` | primary `Button` linking to the watch route |

## Props

```ts
// types.ts
export type ChannelSpotlightSource = 'trailer' | 'returning';
```

```ts
interface ChannelSpotlightRootProps {
  source: ChannelSpotlightSource;
}
```

The card inside is a `VideoCard.Root variant="spotlight"` passed as children, so the video's data is never re-declared here. `source` mirrors the slot the API resolved: `returning` adds an accent edge so a subscriber sees the block is for them.

## Variants

| Source | Difference |
|---|---|
| `trailer` | plain surface |
| `returning` | a 4 px `accent` inline-start edge |

## States

| State | What changes |
|---|---|
| hover | thumbnail lifts 2 px |
| focus | `focus-ring` on Watch and the thumbnail link |
| no video | nothing renders, no placeholder; Home starts where it always did |
| trailer made private or deleted | the API answers `null` for it, so the block drops out with no save |
| loading | the page renders without it and the block appears when the answer arrives; the server render waits for it, so it is in the first paint |

## Responsive behaviour

Compact and medium: the card stacked, the thumbnail up to 480 px. Expanded and up: thumbnail start (up to 640 px), copy end.

## Skeleton

`ChannelSpotlightSkeleton`: card 100 % by 256 px at expanded, padding `inset-card`, radius `card`; thumbnail 16:9 at 460 px; kicker bar 112 by 13, title bars 100 % and 64 % by 37, meta bar 160 by 16, button 96 by `control.md`. Stacked below expanded. Rules in [skeletons](../../components/skeletons.md).

## Motion

Entry: fade at `base` with `enter`. Hover lift `slow` with `settle`. Reduced motion: no lift.

## Accessibility

- A `section` labelled by the kicker; the title is the primary link.
- The accent edge is paired with the kicker text, never the only signal.

## Extension points

- `className` on every part, merged with `cn`.
- `useChannelSpotlight()` returns `{ source, kickerId }` for an app-local part.
- `tv({ extend: channelSpotlightStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `ChannelPageSpotlight` | `channel/components/` | `channelId: string` | `useQuery(channelSpotlightQueryOptions)` keyed by channel, locale and viewer, `useFormat`, `useT`, `useDurationText` |

It fixes the card to `spotlight`, links Watch to the watch route, and renders nothing when the API answers `source: null`.

## Used by

[115](../../../tickets/115-channel-page-customisation.md): the channel page, above Home's content.

## Workbench stories

Trailer; returning subscriber; long title; compact; RTL; skeleton.
