# Button

The one control for an action: it does something now, and it is the only primitive that carries the accent as a fill.

## Anatomy

```
   +--------------------------------+
   |  (1)  Upload video  (2)        |   rest, size md
   +--------------------------------+
        ^ (3) focus ring: `focus` width, `focus-offset`
```

| # | Part | Notes |
|---|---|---|
| 1 | Start icon | Optional `Icon`: `IconSize` `sm` in a `sm` button, `md` in `md` and `lg`. |
| 2 | Label or end icon | `label` type style. Text is never truncated; the button grows. |
| 3 | Focus ring | `focus-ring`, drawn with `outline`, so it never shifts layout. |

While `loading`, the label keeps its width (hidden, not removed) and a `Spinner` is centred over it.

## API

```ts
// types.ts
import type { ControlSize, ToneOption } from '@vp/design-tokens';
import type { FillOption, ShapeOption } from '../../types';

export type ButtonFill = Exclude<FillOption, 'plain'>;
export type ButtonTone = Extract<ToneOption, 'neutral' | 'accent' | 'danger'>;
export type ButtonSize = ControlSize;
export type ButtonShape = ShapeOption;
```

```ts
interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonFill;   // default 'soft'
  tone?: ButtonTone;      // default 'neutral'
  size?: ButtonSize;      // default 'md'
  shape?: ButtonShape;    // default 'text'
  loading?: boolean;
}
```

`variant` is the fill and `tone` is the colour intent. `shape="text"` and `shape="icon"` take the theme's `control` radius (a pill in Sand, 8 px in Nocturne); `icon` is square; `pill` is fully round in every theme. `type` defaults to `button`. Icon-only buttons are normally written as [icon-button](icon-button.md), which is `Button` with `shape="icon"` and a required name. Today's `primary`, `secondary`, `contrast`, `outline`, `ghost` and `destructive` variants become fill and tone pairs, as the table shows.

```tsx
<Button variant="solid" tone="accent" size="lg" loading={saving}>Upload video</Button>
```

## Variants and sizes

| Fill | `neutral` | `accent` | `danger` | When to use |
|---|---|---|---|---|
| `solid` | `fg` on `bg` (the old `contrast`) | `accent`, `accent-hover`, `on-accent` (the old `primary`) | `danger`, white text | `solid` `accent`: the one main action of a view, at most one per region. `solid` `neutral`: over `media` and hero spots where the accent would fight the video. `solid` `danger`: a destructive confirmation. |
| `soft` | `tint`, `tint-strong`, `fg` (the old `secondary`, the default) | `accent-soft`, `accent-ink` | `tint`, `danger-ink` | Any other action. |
| `outline` | `border-strong`, `tint`, `fg` | `border-strong`, `accent-ink` | `border-strong`, `danger-ink` | Actions on a busy ground, paired with a primary. |
| `ghost` | `fg`, `tint` | `accent-ink`, `accent-soft` (the old `ghost`) | `danger-ink`, `tint` | Tertiary and inline actions, toolbars, a quiet destructive action in a menu. |

Red also means live, so `tone="danger"` is for destructive actions only.

| Size | Height | Label | Icon |
|---|---|---|---|
| `sm` | `sizing.control.sm` | `label` | `sizing.icon.sm` |
| `md` | `sizing.control.md` | `label` | `sizing.icon.md` |
| `lg` | `sizing.control.lg` | `label` | `sizing.icon.md` |

Under a coarse pointer the hit area grows to `sizing.layout.touch-target` with a pseudo-element; the painted box does not change.

## States

| State | What changes |
|---|---|
| Rest | Variant roles above. |
| Hover | `solid` `accent` to `accent-hover`; `soft` to `tint-strong`; `outline` and `ghost` gain `tint` or `accent-soft`. `motion.duration.fast`, `motion.easing.standard`. |
| Focus-visible | `focus-ring`, `border.focus` wide with `border.focus-offset`. |
| Pressed | `scale(0.97)` over `motion.duration.instant`; background as hover. |
| Disabled | Ground `tint`, text `fg-subtle`, `cursor: not-allowed`, no opacity trick. Not focusable when native. |
| Loading | `aria-busy`, spinner in `on-accent` or `fg`, clicks ignored, width held. |
| Invalid | Not applicable. |

## Tokens

- Colour roles as in the table plus `danger`, `danger-ink`, `focus-ring`, `fg-subtle`, `tint`.
- `sizing`: `control` sm, md, lg (height), `icon` sm and md, `layout.touch-target`.
- `spacing`: `inset-control` for the inline padding, `gap-inline` between icon and label.
- `border`: `control` (outline fill), `focus` and `focus-offset`.
- `radius`: `control` (`shape="pill"` is fully round). Type `label`.
- `motion`: `fast`, `instant`, easing `standard`.

## Accessibility

- Native `<button>`; with `asChild` on a link the role stays link and `aria-disabled` replaces `disabled`.
- Enter and Space activate; no custom key handling.
- The visible label is the name. A loading button keeps its label in the accessibility tree and sets `aria-busy`.
- Radix `Slot` (via `asChild`) merges props and refs onto the child.
- Contrast: `on-accent` on `accent` is 8:1 in every theme and mode.

## Do and don't

- Do give each region one `solid` `accent` button.
- Do use `loading` for a pending mutation instead of swapping the label.
- Do use `asChild` with the router link for navigation that looks like a button.
- Don't use `tone="danger"` for anything that is not destructive; red also means live.
- Don't set widths in pixels; let the label size the button, use `className="w-full"` only in sheets.
- Don't put two `solid` `accent` buttons side by side; make one `soft`.
- Don't use `margin` to space buttons, put them in a `gap` container.

## In the workbench

Stories: one per `variant` (4) crossed with `tone` (3), one per `size` (3), `shape` text, icon and pill, with start icon, with end icon, `asChild` link, and one per state: hover, focus-visible, pressed, disabled, loading. Axes: both themes by three modes, compact density, RTL (icon moves to the other edge), more contrast, reduced motion (press scale off).
