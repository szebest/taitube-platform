# Progress

A horizontal bar that shows how far a task or a video has got, determinate or indeterminate.

## Anatomy

```
   +============================--------------+
   |  (1) indicator             (2) track     |
   +------------------------------------------+
   (3) optional value text: 62%
```

| # | Part | Notes |
|---|---|---|
| 1 | `Progress.Indicator` | The filled part, `accent`. |
| 2 | Track | `tint-strong`, height by size. |
| 3 | Value text | Optional, outside the bar, `caption` with `tabular-nums`. |

## API

```ts
// types.ts
import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type ProgressSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
export type ProgressTone = Extract<ToneOption, 'accent' | 'neutral'>;
```

```ts
interface ProgressProps extends ComponentPropsWithRef<typeof Progress.Root> { // Radix Progress: value, max
  size?: ProgressSize;     // 4, 6, 8 px; default 'md'
  tone?: ProgressTone;     // default 'accent'
}
// Parts: Progress (root with the indicator built in)
```

No `value` means indeterminate. Today's `Progress` wraps the native `<progress>` with `size`; the target uses Radix Progress so the indicator can animate and take a tone, while keeping the same `size` axis and the `Field` context. Bar heights are component measures (no sizing token covers a bar).

```tsx
<Progress size="sm" value={62} aria-label="Upload progress" />
```

## Variants and sizes

| Tone | Roles | When to use |
|---|---|---|
| `accent` | `accent`, `tint-strong` | Uploads, processing, the viewer's own position. |
| `neutral` | `fg`, `tint-strong` | Over video or in tight chrome. |

Sizes `sm` 4 px, `md` 6 px, `lg` 8 px. The watched bar on a card is 3 px flush to the thumbnail edge and uses this primitive at `sm` with radius none. Track and indicator radius is `chip` (a pill at these heights).

## States

| State | What changes |
|---|---|
| Rest | Indicator width follows `value` over `max`. |
| Updating | Width eases with `motion.duration.base` and `standard`; none under reduced motion. |
| Indeterminate | A segment slides across the track, 1.4 s linear, replaced by a pulsing opacity under reduced motion. |
| Complete | Indicator full; the caller announces completion. |
| Hover, focus, pressed | Not interactive. |
| Invalid | The indicator takes `danger-ink` when the caller sets an error through the surrounding Field. |

## Tokens

- Colour roles `accent`, `fg`, `tint-strong`, `danger-ink`.
- `radius`: `chip`. `spacing`: `gap-inline` to the value text.
- Type `caption` and `mono` for the text. `motion`: `base`, easing `standard`.

## Accessibility

- Radix Progress: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`; indeterminate omits `aria-valuenow`.
- It needs a name: `aria-label` or `aria-labelledby`.
- It does not take focus. Progress that changes often is not live-announced; announce milestones (25 percent steps, done) with a polite region.
- Do not rely on colour: the filled length is the signal.

## Do and don't

- Do use the determinate form whenever the total is known.
- Do show the value text next to long tasks.
- Do use `tone="neutral"` over `media`.
- Don't use it for waiting of unknown shape in a button; use [spinner](spinner.md).
- Don't animate the bar faster than it receives data.
- Don't use `accent` to show a status such as success; accent is position.

## In the workbench

Stories: determinate at 0, 40, 100; indeterminate; each size (3) and tone (2); with value text; inside a card at the thumbnail edge; in a Field. Axes: themes by modes, RTL (fill direction), reduced motion, more contrast.
