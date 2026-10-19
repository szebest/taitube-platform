# Kbd

A keycap that shows a keyboard shortcut or key name inline.

## Anatomy

```
   Search  [ (1) Cmd ] [ (1) K ]
```

| # | Part | Notes |
|---|---|---|
| 1 | Keycap | One key per element, `mono` type, `border.control` outline, radius `xs`. |

A combination is several `Kbd` in a row with a parent `gap`.

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type KbdFill = Extract<FillOption, 'outline' | 'soft'>;
export type KbdSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface KbdProps extends ComponentPropsWithRef<'kbd'> {
  variant?: KbdFill;   // default 'outline'
  size?: KbdSize;      // default 'md'
}
```

The platform glyph (Cmd or Ctrl) is chosen by the caller from the platform; the primitive prints its children. The old `filled` variant is `soft`.

```tsx
<Kbd size="sm">Esc</Kbd>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `outline` | `border-strong` outline, `fg-muted` text | Default hint in menus and the search field. |
| `soft` | `tint` ground, `fg` text | On a `raised` panel or in a tooltip on `fg`, where an outline would vanish. |

Sizes: `sm` uses the `caption` size, `md` the `mono` size; the box is the line height plus block padding (no sizing token covers a keycap). Inside a [tooltip](tooltip.md) the colours invert with the bubble.

## States

| State | What changes |
|---|---|
| Rest | The variant roles. |
| Hover, focus, pressed, disabled | Not interactive. |
| Inside a disabled item | `fg-subtle`, inherited. |

## Tokens

- Colour roles `border-strong`, `fg-muted`, `fg`, `tint`, `fg-subtle`.
- `border`: `control`. `radius`: `xs`. `spacing`: `gap-inline` between keys in a chord.
- Type `mono` and `caption` with `tabular-nums`. Motion: none.

## Accessibility

- A native `<kbd>`, which screen readers announce as text.
- The shortcut does not replace the control's name: the menu item or button keeps its own label, and the shortcut should also be given in `aria-keyshortcuts` on that control.
- Use words for non-obvious keys ("Esc", "Enter") rather than only glyphs; glyph-only keys need a text equivalent.
- Contrast: `fg-muted` on `bg` and `raised` is at least 4.5:1.

## Do and don't

- Do show one key per `Kbd`.
- Do use platform-correct modifier names.
- Do pair a shortcut with an action that is also reachable without it.
- Don't make it clickable.
- Don't show shortcuts on touch-only layouts.
- Don't write a chord as a single `Kbd` ("CmdK").

## In the workbench

Stories: single key, a chord of several `Kbd`, each variant (2) and size (2), in a menu item, in a tooltip, in the search field, long key name. Axes: themes by modes, RTL (chord order is kept), more contrast.
