# SegmentedControl

A compact choice of exactly one among two to five options, shown as joined segments inside a shared track.

## Anatomy

```
   +-----------------------------------+
   | (1)[ (2) Top ] Newest   Oldest    |   (3) track
   +-----------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `SegmentedControl.Item` | One option, text and optional icon. |
| 2 | Indicator | The selected segment's pill, a `surface` ground that slides between items. |
| 3 | Track | `tint` ground, radius `control`, `sizing.control` height by size, with a small inset. |

## API

```ts
// types.ts
import type { ControlSize, ToneOption } from '@vp/design-tokens';

export type SegmentedTone = Extract<ToneOption, 'neutral' | 'accent'>;
export type SegmentedSize = ControlSize;
```

```ts
interface SegmentedControlRootProps extends ComponentPropsWithRef<typeof RadioGroup.Root> { // Radix: value, onValueChange
  tone?: SegmentedTone;     // colour of the selected segment; default 'neutral'
  size?: SegmentedSize;     // default 'md'
}
// Parts: SegmentedControl.Root, SegmentedControl.Item (value)
```

New in 95, replacing the stand-in `.tt-seg`. The group is named with a native `aria-label`. It cannot be empty: there is no deselect. A full-width control is `className="w-full"`. The old `surface` and `accent` variants are `tone="neutral"` and `tone="accent"`; there is no fill axis because the track is always `tint`.

```tsx
<SegmentedControl.Root aria-label="Comment order" value={order} onValueChange={setOrder}>
  <SegmentedControl.Item value="top">Top</SegmentedControl.Item>
  <SegmentedControl.Item value="newest">Newest</SegmentedControl.Item>
</SegmentedControl.Root>
```

## Variants and sizes

| Tone | Roles | When to use |
|---|---|---|
| `neutral` | track `tint`, selected `surface` with `fg`, others `fg-muted`, elevation 1 | Default. |
| `accent` | track `tint`, selected `accent` with `on-accent` | A primary mode switch in a toolbar. At most one per view. |

The track height is `sizing.control` for the size (`sm`, `md`, `lg`); the items fill it less the track inset, with a `sizing.layout.touch-target` hit area under a coarse pointer. Track radius `control`; selected segment radius `control`, inset. Type `label`.

## States

| State | What changes |
|---|---|
| Rest | Unselected items `fg-muted`. |
| Hover | Unselected item to `fg`, `tint` ground. |
| Focus-visible | `focus-ring` on the focused item (roving), `border.focus` wide with `border.focus-offset`. |
| Selected | Indicator slides over `motion.duration.base` with `settle`; text `fg`. |
| Pressed | `scale(0.97)` over `motion.duration.instant`. |
| Disabled | `fg-subtle`; a disabled item is skipped. |
| Reduced motion | The indicator jumps; no slide. |

## Selection indicator

The selected state is one thumb that slides to the chosen option, rather than each option painting its own
ground: it moves and resizes over `duration-base` with `ease-settle` from the motion set, follows a resize, a
direction change and (in a scrolling group) the scroll, and does not animate its first placement. The thumb is `surface` with `elevation-1` and the `control` radius role. The
selected option keeps its text colour change, so the state reads even before the indicator arrives. Under the
`reduced` motion set (chosen, or forced by `prefers-reduced-motion`) the indicator changes position without
sliding. One shared helper in `@vp/ui` measures the selected option and drives the indicator for every group
that has one (`useSlidingIndicator`); no component positions its own.

## Tokens

- Colour roles `tint`, `surface`, `fg`, `fg-muted`, `fg-subtle`, `accent`, `on-accent`, `focus-ring`.
- `sizing`: `control` sm, md, lg, `layout.touch-target`. `spacing`: `inset-control`, `gap-inline`.
- `radius`: `control`, `sm`. `border`: `focus`, `focus-offset`. `shadow`: elevation 1.
- Type `label`. `motion`: `base`, `instant`, easing `settle`.

## Accessibility

- Built on Radix RadioGroup so it is a `role="radiogroup"` of `radio` items with one tab stop. The stand-in uses `aria-pressed`; the real component does not.
- Arrow keys move and select together; Home and End jump; Space selects. Direction follows `dir`.
- The group needs an `aria-label`. Each item has visible text or an `aria-label`.
- Selected state is not colour alone: the selected segment has a raised ground and more contrast adds an underline.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `SegmentedControl.Item`.
- `useSegmentedControl()` returns `{ tone, size, value }`, so a part written in an app can read it.
- `segmentedControlStyles`, the `tv()` definition, is exported: `tv({ extend: segmentedControlStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do use it for 2 to 5 options with short labels.
- Do keep labels parallel in grammar and length.
- Do pick it over a [select](select.md) when the options fit on one line.
- Don't use it for navigation; use [tabs](tabs.md).
- Don't use it when several can be on; use [toggle-group](toggle-group.md).
- Don't exceed one line; wrap to a select on compact if needed.

## In the workbench

Stories: two, three and five options, each tone (2) and size (3), icon and text, icon only, full width via `className`, disabled item, long labels, controlled. States: rest, hover, focus-visible, selected, disabled. Axes: themes by modes, RTL (indicator direction), compact density, reduced motion, more contrast, 320 px width.
