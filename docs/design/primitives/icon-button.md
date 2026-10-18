# IconButton

A button that shows only an icon, so it always carries a visible accessible name through a required label and a tooltip.

## Anatomy

```
   ( (1) )      `sizing.control.md` square, a circle in Sand, 8 px corners in Nocturne
      ^
      (2) tooltip on hover and focus, from the `aria-label`
```

| # | Part | Notes |
|---|---|---|
| 1 | Icon | One `Icon`: `IconSize` `sm`, `md`, `lg` for a `sm`, `md`, `lg` button. Never a filled swap for the active state. |
| 2 | Tooltip | Shown with the `Tooltip` primitive; the same text is the `aria-label`. |

## API

```ts
// types.ts
import type { ButtonProps } from '../button';

export type IconButtonProps = Omit<ButtonProps, 'shape' | 'children'> & {
  'aria-label': string;        // required: the accessible name
  children: ReactElement;      // the icon
};
```

```ts
// inherited from ButtonProps: variant?: ButtonFill, tone?: ButtonTone, size?: ControlSize
// IconButton defaults variant to 'ghost'
```

`IconButton` is `Button` with `shape="icon"` and `variant` defaulting to `ghost`; it takes the same `variant`, `tone` and `size`, so it adds no union of its own (`Omit` removes object keys, the union stays `Button`'s). A toggle is the native `aria-pressed`. A tooltip is composed by the caller with [tooltip](tooltip.md), not a prop. Today's `IconButton` already takes `aria-label`.

```tsx
<IconButton aria-label="Save to Watch later" variant="soft"><Bookmark /></IconButton>
```

## Variants and sizes

| Fill and tone | Roles | When to use |
|---|---|---|
| `ghost` `neutral` (default) | `fg`, `tint` | Toolbars, headers, player chrome. |
| `soft` `neutral` | `tint`, `tint-strong` | A standalone icon action on a card. |
| `outline` `neutral` | `border-strong` | Icon actions on a busy ground. |
| `solid` `accent` | `accent`, `on-accent` | Play, a floating create action. Rare. |
| `solid` `neutral` | `fg`, `bg` | Over video where `scrim` is behind it. |
| `ghost` `danger` | `danger-ink`, `tint` | A destructive icon action. |

| Size | Box | Icon |
|---|---|---|
| `sm` | `sizing.control.sm` | `sizing.icon.sm` |
| `md` | `sizing.control.md` | `sizing.icon.md` |
| `lg` | `sizing.control.lg` | `sizing.icon.lg` |

The hit area is at least `sizing.layout.touch-target` under a coarse pointer.

## States

| State | What changes |
|---|---|
| Rest | `ghost`: transparent, `fg` icon. |
| Hover | `tint` ground (`ghost`), `fast`. |
| Focus-visible | `focus-ring`, `border.focus` wide with `border.focus-offset`; tooltip opens. |
| Pressed (momentary) | `tint-strong`, `scale(0.97)` over `motion.duration.instant`. |
| Pressed (toggle) | `aria-pressed="true"`: `accent-soft` ground and `accent-ink` icon, same glyph. |
| Disabled | `fg-subtle` icon, no ground, tooltip off. |
| Loading | Spinner replaces the icon, `aria-busy`. |

## Tokens

- Colour roles `fg`, `tint`, `tint-strong`, `accent-soft`, `accent-ink`, `accent`, `on-accent`, `danger-ink`, `focus-ring`.
- `sizing`: `control` sm, md, lg (the box), `icon` sm, md, lg, `layout.touch-target`.
- `border`: `focus`, `focus-offset`. `radius`: `control`. No type style (no text).
- `motion`: `fast`, `instant`.

## Accessibility

- Native `<button>` with `aria-label`. The tooltip is a description, not the only name.
- A toggle sets `aria-pressed`; the label stays constant ("Mute", not "Muted").
- A disabled icon button does not fire tooltip events; wrap in a span only if the reason must be shown.
- Enter and Space activate. The tooltip closes with Escape (Radix Tooltip).

## Do and don't

- Do use a verb for the label ("Save to Watch later").
- Do swap state through `aria-pressed`, never by changing the glyph to a filled one.
- Do keep a group of icon buttons on `gap`, not margins.
- Don't ship an icon button without `aria-label`; the type forbids it.
- Don't use `solid` `accent` more than once per view.
- Don't nest it in another interactive element.

## In the workbench

Stories: one per fill and tone pair in the table (6), per size (3), toggle on and off, `asChild` link, disabled, loading, tooltip open, over `media` with `solid` `neutral`. Axes: themes by modes, RTL (directional icons mirror), compact density, coarse pointer hit area overlay.
