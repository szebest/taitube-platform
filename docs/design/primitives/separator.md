# Separator

A thin line that divides content groups, decorative by default.

## Anatomy

```
   Group one
   ------------------------  (1) horizontal line
   Group two   |   Group three   (2) vertical line
```

| # | Part | Notes |
|---|---|---|
| 1 | Horizontal rule | `border.divider` thick, full width. |
| 2 | Vertical rule | `border.divider` thick, full height of its flex row. |

## API

```ts
// types.ts
import type { Orientation } from '../../types';

export type SeparatorOrientation = Orientation;
export type SeparatorTone = 'subtle' | 'strong';
```

```ts
interface SeparatorProps extends Omit<ComponentPropsWithRef<typeof Separator.Root>, 'orientation'> { // Radix: decorative
  orientation?: SeparatorOrientation;  // default 'horizontal'
  tone?: SeparatorTone;                // default 'subtle'
}
```

`decorative` is the Radix prop (true by default). `SeparatorTone` stays component-local: it picks between two border roles, which no shared union names. Today's `Separator` has `orientation` and `decorative`, with no `tone`. Spacing around it is `gap` in the parent, never margins on the separator.

```tsx
<Separator tone="subtle" />
```

## Variants and sizes

| Tone | Roles | When to use |
|---|---|---|
| `subtle` | `border` | Between groups, list rows, inside menus. |
| `strong` | `border-strong` | Where a divider must be seen at 3:1: between toolbar groups on a busy ground. |

No sizes: its thickness is `border.divider`. In menus the line is inset by `spacing.gap-inline` on both ends.

## States

| State | What changes |
|---|---|
| Rest | `border` or `border-strong`. |
| Hover | A hovered divider that is also a resize handle takes `border-strong` (that is a different component); the separator itself does not respond. |
| Focus, pressed, disabled, invalid, loading | Not applicable. |

## Tokens

- Colour roles `border`, `border-strong`. `border`: `divider` (thickness). `spacing`: `gap-inline` (menu inset).
- Radius, type and motion: none.

## Accessibility

- Decorative by default: `role="none"`. A semantic one (`decorative={false}`) is `role="separator"` with `aria-orientation`.
- Use semantic only when the division is meaningful to a screen reader, such as a menu with groups (Radix menus add their own).
- No focus, no keyboard.
- Do not use an `hr` inside flex rows without `align-self: stretch`; the vertical form needs a height.

## Do and don't

- Do use `gap` for spacing, and a separator only when spacing alone is not enough.
- Do prefer whitespace first.
- Do use `strong` only where contrast demands it.
- Don't draw boxes of separators; use a [card](card.md).
- Don't use it as a heading underline.
- Don't set its colour by hand.

## In the workbench

Stories: horizontal, vertical in a toolbar, in a menu, subtle and strong, semantic form, on `bg`, `surface` and `raised`. Axes: themes by modes, RTL, more contrast.
