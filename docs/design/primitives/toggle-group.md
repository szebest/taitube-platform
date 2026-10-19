# ToggleGroup

A row of related buttons that each toggle on or off, with single or multiple selection.

## Anatomy

```
   +------+------+------+
   | (1)  |  (1) |  (1) |   (2) divider or gap
   | B    |  I   |  U   |
   +------+------+------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `ToggleGroup.Item` | A pressed or unpressed button with icon, label, or both. |
| 2 | Joint | Items touch when there are 3 or more, else sit on a `gap-inline` step. |

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';
import type { FillOption, Orientation, ShapeOption } from '../../types';

export type ToggleFill = Extract<FillOption, 'outline' | 'ghost' | 'soft'>;
export type ToggleSize = ControlSize;
export type ToggleShape = Extract<ShapeOption, 'text' | 'pill'>;
```

```ts
interface ToggleGroupRootProps extends ComponentPropsWithRef<typeof ToggleGroup.Root> { // Radix: type, value, onValueChange
  variant?: ToggleFill;          // default 'ghost'
  size?: ToggleSize;             // default 'md'
  shape?: ToggleShape;           // default 'text' (the control radius)
  orientation?: Orientation;     // default 'horizontal'
}
// Parts: ToggleGroup.Root, ToggleGroup.Item (value)
```

New in 95. Icon-only items need an `aria-label`. For "exactly one of a few text options" prefer [segmented-control](segmented-control.md), which cannot be left empty.

```tsx
<ToggleGroup.Root type="multiple" aria-label="Text style" variant="outline">
  <ToggleGroup.Item value="bold" aria-label="Bold"><Bold /></ToggleGroup.Item>
  <ToggleGroup.Item value="italic" aria-label="Italic"><Italic /></ToggleGroup.Item>
</ToggleGroup.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `ghost` | `fg`; pressed `tint-strong` | Toolbars: text formatting, view options. |
| `outline` | `border-strong`; pressed `tint` | A standalone group on a busy ground. |
| `soft` | `fg-muted`; pressed `accent-soft` with `accent-ink` | A selected view or filter that should read as chosen. |

Sizes: heights `sizing.control` sm, md, lg; icons `sizing.icon` sm, md, md. Radius `control`, or fully round with `shape="pill"`; touching items round only the outer corners.

## States

| State | What changes |
|---|---|
| Rest | Unpressed per variant. |
| Hover | `tint` ground, `motion.duration.fast`. |
| Focus-visible | `focus-ring` on the item; one tab stop for the group (roving). |
| Pressed (on) | Variant's pressed roles, `aria-pressed="true"`. |
| Pressed (momentary) | `scale(0.97)` over `motion.duration.instant`. |
| Disabled | `fg-subtle`, no ground; roving focus skips it. |
| Invalid, loading | Not applicable. |

## Tokens

- Colour roles `fg`, `fg-muted`, `fg-subtle`, `tint`, `tint-strong`, `accent-soft`, `accent-ink`, `border-strong`, `focus-ring`.
- `sizing`: `control` sm, md, lg, `icon` sm, md. `spacing`: `gap-inline`, `inset-control`. `radius`: `control`, `sm`. `border`: `control`, `focus`, `focus-offset`.
- Type `label`. `motion`: `fast`, `instant`.

## Accessibility

- Radix ToggleGroup: a `role="group"` (single type uses `radio` semantics for items in Radix), items with `aria-pressed` or `aria-checked`.
- Tab enters the group once; arrow keys move between items; Home and End jump; Space or Enter toggles. Direction follows `dir`.
- The group needs a name (`aria-label`) when no visible heading precedes it.
- State is shown by more than colour: pressed items change ground and keep their glyph, and more contrast adds a bottom bar.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `ToggleGroup.Item`.
- `useToggleGroup()` returns `{ variant, size, shape, orientation }`, so a part written in an app can read it.
- `toggleGroupStyles`, the `tv()` definition, is exported: `tv({ extend: toggleGroupStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do use it for formatting and view toggles where multiple may be on.
- Do give icon items labels and tooltips.
- Do let 3 or more items touch.
- Don't use it for navigation; that is [tabs](tabs.md).
- Don't use it when exactly one must always be chosen; use [segmented-control](segmented-control.md).
- Don't mix icon and text items without a reason.

## In the workbench

Stories: single, multiple, each variant (3) and size (3), attached and separate, icon only, icon and text, vertical, disabled item, controlled. States: rest, hover, focus-visible, pressed on, disabled. Axes: themes by modes, RTL (order reverses), compact density, more contrast, 320 px width overflow.
