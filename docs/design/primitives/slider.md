# Slider

A draggable value or range along a track; the base the seek bar and the volume control are built on.

## Anatomy

```
   (1)==========(2)o---------------(3)
    track filled   thumb   buffered or remainder
                  (4) value tooltip on drag
```

| # | Part | Notes |
|---|---|---|
| 1 | `Slider.Range` | The filled portion, `accent`. |
| 2 | `Slider.Thumb` | `sizing.icon.md` circle, `fg`, with a `sizing.layout.touch-target` invisible hit area. |
| 3 | `Slider.Track` | `tint-strong`; may hold a `Slider.Buffered` fill in `tint`. |
| 4 | Value tip | A [tooltip](tooltip.md) shown while dragging, from `formatValue`. |

## API

```ts
// types.ts
import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type SliderSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
export type SliderTone = Extract<ToneOption, 'accent' | 'neutral'>;
```

```ts
interface SliderRootProps extends ComponentPropsWithRef<typeof Slider.Root> {  // Radix Slider: value, min, max, step, dir, orientation (Orientation)
  size?: SliderSize;       // track 4, 6, 8 px; default 'md'
  tone?: SliderTone;       // default 'accent'
}
// Parts: Slider.Root (track and range built in), Slider.Buffered (value), Slider.Thumb (aria-label, aria-valuetext)
```

One or two thumbs follow the length of `value`. `orientation` is the Radix prop, typed as the shared `Orientation`. The thumb's name and `aria-valuetext` are native props on `Slider.Thumb`. Track heights are component measures (no sizing token covers a bar). New in 95. A `Slider` is not the player's seek bar itself: the seek bar is built from it, adding chapters and the preview sprite.

```tsx
<Slider.Root size="sm" tone="neutral" value={[volume]} onValueChange={([v]) => setVolume(v)}>
  <Slider.Thumb aria-label="Volume" />
</Slider.Root>
```

## Variants and sizes

| Tone | Roles | When to use |
|---|---|---|
| `accent` | `accent`, `tint-strong`, thumb `fg` | Seek, settings that show position. |
| `neutral` | `fg`, `tint-strong`, thumb `fg` | On video chrome (volume), where accent would compete with the picture. |

Sizes: `sm` 4 px track (volume, over video), `md` 6 px (forms), `lg` 8 px (touch seek). Track and range ends use radius `chip`, which clamps to a pill at these heights.

## States

| State | What changes |
|---|---|
| Rest | Track and range as above; thumb smaller than `sizing.icon.md` on pointer devices when idle in player chrome. |
| Hover | Track grows to the next size over `motion.duration.fast`; thumb `sizing.icon.md`. |
| Focus-visible | `focus-ring` around the thumb. |
| Dragging | Thumb scales 1.15; value tip visible; no transition on the range, so it tracks 1:1. |
| Disabled | Range `fg-subtle`, thumb `fg-subtle`. |
| Invalid | Not applicable. |
| Loading | Not applicable; buffered shows progress. |

## Tokens

- Colour roles `accent`, `fg`, `tint`, `tint-strong`, `fg-subtle`, `focus-ring`.
- `sizing`: `icon.md` (thumb), `layout.touch-target`. `radius`: `chip`. `border`: `focus`, `focus-offset`.
- Type `caption` (the value tip), `mono` with `tabular-nums`. `motion`: `fast`, `instant`.

## Accessibility

- Radix Slider: each thumb is `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-orientation`.
- Arrow keys move one `step`, Page Up and Down move 10 steps, Home and End jump to the ends. In RTL, horizontal arrows reverse.
- `formatValue` supplies `aria-valuetext` ("1:24 of 18:42"), so values are meaningful, not raw numbers.
- Each thumb needs a name: `aria-label` on `Slider.Thumb`, or a visible Label with `aria-labelledby`.
- The thumb's hit area is at least `sizing.layout.touch-target` under a coarse pointer.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Slider.Thumb` and `Slider.Buffered`.
- `useSlider()` returns `{ size, tone, orientation }`, so a part written in an app can read it.
- `sliderStyles`, the `tv()` definition, is exported: `tv({ extend: sliderStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do give every slider `formatValue` when the number is not self-explanatory.
- Do use `onValueCommit` for network writes and `onValueChange` for live preview.
- Do use `tone="neutral"` over `media`.
- Don't use a slider for a precise number entry; add an [input](input.md).
- Don't use it for two or three discrete options; use [segmented-control](segmented-control.md).
- Don't animate the range while dragging.

## In the workbench

Stories: single, range, each size (3) and tone (2), with buffered, vertical (volume), with value tip, with steps, disabled, over `media`. States: rest, hover, focus-visible, dragging, disabled. Axes: themes by modes, RTL (fill direction and keys), reduced motion, coarse pointer hit areas, more contrast.
