# ContextMenu

The same menu as DropdownMenu, opened by right-click or long-press on a region instead of a button.

## Anatomy

```
   +--------------------------------+
   |  (1) Region (right-click here) |
   |        +---------------------+ |
   |        | (2) Item        (3) | |
   |        | (2) Item            | |
   |        +---------------------+ |
   +--------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `ContextMenu.Trigger` | Wraps the target; takes `asChild`, no wrapper element needed. |
| 2 | Items | Identical parts to [dropdown-menu](dropdown-menu.md). |
| 3 | `Shortcut` | A [kbd](kbd.md). |

## API

```ts
// types.ts (shared with dropdown-menu)
import type { Align, Side } from '../../types';
import type { MenuSize, MenuTone } from '../dropdown-menu/types';
```

```ts
interface ContextMenuContentProps extends Omit<ComponentPropsWithRef<typeof ContextMenu.Content>, 'side' | 'align'> {
  size?: MenuSize;        // default 'md'
  side?: Side;            // default 'inline-end'
  align?: Align;          // default 'start'
}
interface ContextMenuItemProps extends ComponentPropsWithRef<typeof ContextMenu.Item> {
  tone?: MenuTone;        // default 'neutral'
}
// Parts: ContextMenu.Root, .Trigger, .Content, .Group, .Label, .Item, .CheckboxItem, .RadioGroup, .RadioItem,
//   .Separator, .Shortcut, .Sub, .SubTrigger, .SubContent
```

Every `Item` is a Radix item, so `onSelect`, `disabled` and `textValue` are Radix props. `Shortcut` holds a [kbd](kbd.md) child.

Items and styling are the same as [dropdown-menu](dropdown-menu.md), including its `MenuSize` and `MenuTone`; only the trigger differs (a region, `asChild`). `ContextMenu` is new in 95.

```tsx
<ContextMenu.Root>
  <ContextMenu.Trigger asChild><article>...</article></ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item>Add to queue</ContextMenu.Item>
    <ContextMenu.Item tone="danger">Not interested</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `Content` | `raised`, `border`, elevation 2, radius `card` | Every context menu. |
| `Item` neutral and danger | as dropdown-menu | As dropdown-menu. |

The player's quiet chrome puts quality, speed and stats in this menu (the guide's "settings and context menus"). Keep the item set identical to the visible overflow menu so a touch user, who has no right-click, reaches the same actions.

## States

| State | What changes |
|---|---|
| Open | Appears at the pointer with `motion.duration.base` and `enter`; keyboard-opened (Shift+F10, the context-menu key) has no animation. |
| Highlighted | `tint` ground. |
| Focus-visible | The highlight; the region shows `focus-ring` while open. |
| Disabled item | `fg-subtle`. |
| Long press | Opens after 700 ms on touch (Radix), with haptics left to the platform. |

## Tokens

Same sets as dropdown-menu: colour roles `raised`, `border`, `fg`, `fg-muted`, `fg-subtle`, `tint`, `accent-ink`, `danger-ink`; `sizing.control` sm, md and `icon.sm`; `spacing` `inset-control`, `gap-inline`; `radius` `card` and `sm`; `border.divider`; `shadow` elevation 2; type `label`, `overline`, `mono`; `motion` `base`, `exit`, `enter`; z `popover`.

## Accessibility

- Radix ContextMenu: `role="menu"`, same keyboard model as DropdownMenu once open.
- Opens with right-click, long press, Shift+F10 or the context-menu key when the region has focus; so the region must be focusable (a card link already is).
- Never the only path: every action also exists in a visible control.
- Escape closes and returns focus to the region.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger` and `Item`.
- `useContextMenu()` returns `{ size }` and the open state, so a part written in an app can read it.
- `menuStyles`, the `tv()` definition, is exported: `tv({ extend: menuStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do mirror the overflow menu's items.
- Do keep it for secondary actions on a card, a queue row or the player.
- Do set `disabled` where the browser menu is more useful (text inputs, links being copied).
- Don't hide primary actions here.
- Don't attach it to tiny targets; the region should be at least `sizing.layout.touch-target`.
- Don't open it on left click.

## In the workbench

Stories: on a video card region, on a queue row, in the player surface, with submenu, danger item, disabled trigger falling back to the browser menu, keyboard-opened, near each viewport edge. Axes: themes by modes, RTL, compact density, reduced motion, touch long-press emulation.
