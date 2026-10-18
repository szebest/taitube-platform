# Stage

Location: `apps/client/web/src/components/watch/stage/`. Web's app kit, presentational and compound, built from `AspectRatio`, `Spinner` and `Button`.

The black media ground the player sits on, with an ambient glow sampled from the video that bleeds into the warm page ground. It is the "Ambient stage" signature move, on the watch page and under a channel banner.

## Anatomy

```
         glow, blurred by ambient.blur, opacity var(--ambient), behind everything
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 1 media ground (black), 16:9, radius card                    │ │
│ │               2 player slot                                  │ │
│ │ 3 overlay slot (chapter title, end screen)                   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│  4 view-transition-name from the video id                         │
└──────────────────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Root` | `media` ground (black in every mode), radius `card`, `elevation-3`; carries the `view-transition-name` |
| 2 | `Player` | the wrapper puts the player from [57](../../../tickets/57-production-video-player-hls-streaming-controls.md) here; Stage owns no controls |
| 3 | `Status`, `Poster` | positioned covers for poster, loading, error |
| 4 | `Glow` | absolute layer, `inset: -80px`, `filter: blur(var(--ambient-blur))`, `z-index: -1`, `pointer-events: none` |

## Props

```ts
// types.ts
export type StageVariant = 'standard' | 'theater' | 'vertical' | 'banner';
export type StageStatusKind = 'loading' | 'error' | 'unavailable';
```

```ts
interface StageRootProps {
  variant?: StageVariant;
  videoId?: string;
  glowColors?: string[];
}

interface StageStatusProps {
  kind: StageStatusKind;
  onRetry?: () => void;
}
```

`Stage.Glow` reads `glowColors` (one to three sampled, smoothed CSS colours) from context; without it, or with `data-ambient="off"` (the ambient set `off`, the viewer's choice, and `data-contrast="more"`), no glow renders, so there is no intensity prop. Retry appears only when `onRetry` is passed. `videoId` gives the shared-element name, the same one `VideoThumbnail` (so [VideoCard](video-card.md)) carries, from one helper in `@vp/components`.

## Variants

| Variant | Difference |
|---|---|
| `standard` | 16:9 in the left column, radius `card` |
| `theater` | full content width, radius `0` at compact, max height 80 vh; the queue moves below |
| `vertical` | 9:16 for Shorts, drawn by [ShortsPlayerFrame](shorts-player-frame.md) with Stage's ground and glow |
| `banner` | no player: the glow tint under a channel banner |

## States

| State | What changes |
|---|---|
| loading | poster on the ground, centred `Spinner` after 400 ms; no layout change |
| ready | glow follows `glowColors` |
| paused | the glow dims to 60 % of the ambient opacity |
| error | overlay with the message and a retry `Button`; size unchanged |
| unavailable | `tint` icon ground and message, no retry |

## Responsive behaviour

Compact: full bleed, radius `0`, glow off (cost, no room), sticky under the header. Medium: within `gutter-medium`, glow on. Expanded: left column of the two-column layout. Large: theater available. The poster is the LCP candidate and renders in the server HTML at its final size.

## Skeleton

`StageSkeleton`: a 16:9 `media` block, radius `card`, no glow. Rules in [skeletons](../../components/skeletons.md).

## Motion

Glow colour change crossfades over `slow`, never faster. Opening from a card: the thumbnail morphs in through the shared name at `cinematic`. Theater toggle: `base` with `settle`. Reduced motion: static first sample, no shared element, theater is a cut.

## Accessibility

- `role="region"` labelled "Video player"; the player owns its controls and shortcuts.
- Glow and covers are `aria-hidden`, except an error, which is `role="alert"` once. Poster `alt` is the video title.
- Contrast near the stage is measured against `bg`, never the glow.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Player` and `Poster`.
- `useStage()` returns `{ variant, videoId, glowColors, status }` for an app-local overlay such as an end screen.
- `tv({ extend: stageStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `WatchStage` | `watch/components/` | `video: Video` | `useAmbientSample(posterUrl)`, `usePlayback`, `useT` |

It fixes `variant` from the theater preference, hands the player to `Stage.Player`, and maps playback errors to `Stage.Status`. Banner tint is drawn by `ChannelPageHeader` ([ChannelHeader](channel-header.md)).

## Used by

[59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) the stage, theater, LCP poster; [57](../../../tickets/57-production-video-player-hls-streaming-controls.md) the player slot's host; [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) the channel banner tint.

## Workbench stories

Standard with a warm glow; cool glow with a bright poster; theater; loading with poster; error with retry; unavailable; ambient off; compact sticky; banner; skeleton.
