# VideoThumbnail

The frame of a video: the image at a fixed ratio, the duration chip, the watched-progress strip, a slot for badges and the live marker. It is the one piece of video UI both apps draw: web's [VideoCard](../apps/web/video-card.md) wraps it for every card, and studio's `LibraryVideoRow` draws it at the start of every library row. It carries no signature move of its own, only the shared element: its root sets the `view-transition-name` that morphs into web's [Stage](../apps/web/stage.md).

## Anatomy

```
┌──────────────────────────────┐
│ [1 4K]                [3 LIVE]│   Root: AspectRatio, radius thumb, inset border
│                              │   Image: cover, fades in
│                              │
│                    [2 18:42] │   Duration: bottom end, scrim chip
│▇▇▇▇▇▇▇▇▇▇▇░░░░░░░░░░░░░░ 4   │   Progress: bottom edge strip
└──────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| root | Frame | `AspectRatio` at 16:9 (`landscape`) or 9:16 (`portrait`), radius `thumb`, `tint` ground behind the image, inset border at 8 % `fg`, `overflow: hidden`, `view-transition-name` from `videoId` |
| image | `Image` | `object-fit: cover`; fades in at `base`; with no `src` the `tint` ground and a centred `Icon` (`IconSize` `lg`) show instead, for a video still processing |
| 1 | `Badge` slot | start-top corner, children are `Badge` primitives (4K, NEW, a status); the part only positions them |
| 2 | `Duration` | `mono`, `tabular-nums`, `scrim` chip, radius `xs`, bottom end corner, the app's formatted string |
| 3 | `Live` | end-top corner, a `Badge` with tone `live` and a pulsing dot; replaces `Duration` while live |
| 4 | `Progress` | bottom edge strip, `border.focus` width high, `accent` on `tint-strong`; only when `value` is above 0 |

## Props

Plus the standard props. The image URL, alt text, duration and progress are the app's; nothing here formats or fetches.

```ts
// types.ts
import type { RadiusOption } from '@vp/design-tokens';

export type VideoThumbnailAspect = 'landscape' | 'portrait';
export type VideoThumbnailRadius = Extract<RadiusOption, 'thumb'>;
```

```ts
interface VideoThumbnailRootProps {
  aspect?: VideoThumbnailAspect; // default 'landscape'; 'portrait' is the 9:16 poster for Shorts
  videoId?: string;              // sets view-transition-name to `video-<videoId>`; omit where no Stage follows
}
interface VideoThumbnailImageProps {
  src?: string;
  alt?: string;                  // default '' (decorative: the title names the video)
}
interface VideoThumbnailProgressProps {
  value: number;                 // 0 to 1
}
// Parts: VideoThumbnail.Root, .Image, .Duration, .Progress, .Badge, .Live
```

```tsx
<VideoThumbnail.Root videoId={video.id}>
  <VideoThumbnail.Image src={video.posterUrl} />
  <VideoThumbnail.Badge><Badge tone="neutral">4K</Badge></VideoThumbnail.Badge>
  <VideoThumbnail.Duration>18:42</VideoThumbnail.Duration>
  <VideoThumbnail.Progress value={0.62} />
</VideoThumbnail.Root>
```

The radius is always the `thumb` role, so `VideoThumbnailRadius` has one member and is not a prop: it types the variant map (`satisfies Record<VideoThumbnailRadius, string>`) so a second role is a type error until styled. The progress value reaches assistive technology as text built inside from `useUiCopy()` ("62 percent watched").

## Extension points

| Need | Point |
|---|---|
| A one-off tweak (a fixed width in a row) | `className` on `Root` |
| A different image element (a framework image, a preview video) | `asChild` on `VideoThumbnail.Image` |
| An extra overlay (web's hover preview, studio's selection checkbox) | any element inside `Root`, positioned by the app, or a part reading `useVideoThumbnail()` (aspect, videoId) |
| An app-local look | `tv({ extend: videoThumbnailStyles, variants: { ... } })` |

## Variants

| `aspect` | Layout |
|---|---|
| `landscape` | 16:9, the grid, shelf, row and spotlight frames of web and every studio library row |
| `portrait` | 9:16, the Shorts poster; the `Duration` chip moves to the start-bottom corner so a title overlay owns the end |

## States

| State | What changes |
|---|---|
| rest | as drawn |
| loading image | `tint` ground, the image fades in at `base` when decoded |
| no image | `tint` ground and a centred `Icon`; for a video still processing or whose poster failed |
| partly watched | `Progress` strip shown |
| live | `Live` shown in place of `Duration`; `Progress` hidden |
| unavailable | the app passes no `Image` and a `Badge` child; the frame stays so a list does not reflow |
| skeleton | `VideoThumbnailSkeleton`, see [skeletons](skeletons.md) |

## Responsive behaviour

The frame is fluid and the container sets its width (a grid column, a row's `row-thumb`, a poster width), so the component has no breakpoints of its own. The `Duration` chip and `Badge` insets use `gap-inline` and shrink with the spacing set.

## Motion

- Shared element: `view-transition-name` morphs the frame into the Stage at `cinematic` with `settle` when the router starts a view transition.
- Image fade-in: `base`.
- The live dot pulses at `slow`, looped.
- Hover lift and preview are the card's, not the frame's.
- Reduced motion: a static live dot beside the `LIVE` label, no morph; the swap is a cut.

## Accessibility

- The image has `alt=""` unless the app passes `alt`, because the title beside it names the video.
- `Duration` and `Progress` text is exposed once, visually hidden, as "18 minutes 42 seconds, 62 percent watched", built from the formatted strings and `useUiCopy()`; the visual chip is `aria-hidden`.
- `Live` is a `Badge` with the word "Live", never the dot alone.
- Chip text sits on `scrim` at 4.5:1 over any image.
- The frame is not focusable; the link around it is the card's or row's.

## Composition

`AspectRatio`, `Badge`, `Progress` (strip), `Icon`, `VisuallyHidden`.

## Used by

- Web: [58](../../tickets/58-modern-browse-layout-microinteractions-motion.md), [59](../../tickets/59-video-watch-page-responsive-layout-enhancements.md), [73](../../tickets/73-frontend-youtube-playlists-library-player-queue.md), [74](../../tickets/74-frontend-multi-resource-search-discovery-ui.md): through [VideoCard](../apps/web/video-card.md) in every variant; the shared element to [Stage](../apps/web/stage.md)
- Studio: [60](../../tickets/60-creator-studio-dashboard-video-management-ui.md): the leading cell of `LibraryVideoRow` ([studio README](../apps/studio/README.md))

## Workbench stories

- Landscape with image, duration and progress
- With badges (4K, NEW)
- Live
- No image (processing)
- Portrait
- Long duration (3:42:10)
- Over a very bright and a very dark image (chip contrast)
- RTL (chip and badge corners mirror)
- Skeleton
