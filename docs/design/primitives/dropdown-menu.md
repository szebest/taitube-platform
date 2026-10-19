# DropdownMenu

A list of actions opened from a button, with items, checkable items, radio groups and submenus.

## Anatomy

```
   [ (1) Trigger v ]
        +--------------------------+
        | (2) Group label          |
        | (3) icon  Item     (4) K |
        | (3) icon  Item           |
        |--- (5) separator --------|
        | (6) o Radio item         |
        | (7) [x] Checkbox item    |
        | (3) icon  Submenu     >  |
        +--------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Trigger` | Any button, usually an [icon-button](icon-button.md). |
| 2 | `Label` | `overline` in `fg-muted`. |
| 3 | `Item` | Row at `sizing.control` sm or md, icon at the start. |
| 4 | `Shortcut` | A [kbd](kbd.md), aligned to the end. |
| 5 | `Separator` | A [separator](separator.md). |
| 6 | `RadioItem` | With `ItemIndicator`. |
| 7 | `CheckboxItem` | With `ItemIndicator`. |

## API

```ts
// types.ts
import type { ControlSize, ToneOption } from '@vp/design-tokens';
import type { Align, Side } from '../../types';

export type MenuSize = Extract<ControlSize, 'sm' | 'md'>;
export type MenuTone = Extract<ToneOption, 'neutral' | 'danger'>;
```

```ts
interface DropdownMenuContentProps extends Omit<ComponentPropsWithRef<typeof DropdownMenu.Content>, 'side' | 'align'> {
  size?: MenuSize;        // default 'md'
  side?: Side;            // logical; mapped to Radix's physical side by direction. Default 'block-end'
  align?: Align;          // default 'start'
}
interface DropdownMenuItemProps extends ComponentPropsWithRef<typeof DropdownMenu.Item> {
  tone?: MenuTone;        // default 'neutral'
}
// Parts: DropdownMenu.Root, .Trigger, .Content, .Group, .Label, .Item, .CheckboxItem, .RadioGroup, .RadioItem,
//   .Separator, .Shortcut, .Sub, .SubTrigger, .SubContent
```

`MenuSize` and `MenuTone` are shared with [context-menu](context-menu.md) through the menu folder's `types.ts`. Every `Item` is a Radix item, so `onSelect`, `disabled` and `textValue` are Radix props. `Shortcut` holds a [kbd](kbd.md) child. `side` and `align` use the shared `Side` and `Align` (so RTL needs no change); `sideOffset` (default 4) is the Radix prop. Today's flat exports and the item's `variant="danger"` (from a shared `panelVariants`) become compound parts and `tone="danger"`; the checked and radio indicators are built into `CheckboxItem` and `RadioItem`.

```tsx
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild><IconButton aria-label="More"><MoreHorizontal /></IconButton></DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item>Save to Watch later</DropdownMenu.Item>
    <DropdownMenu.Item>Add to queue <DropdownMenu.Shortcut><Kbd>Q</Kbd></DropdownMenu.Shortcut></DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item tone="danger">Remove</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `Content` | `raised`, `border`, elevation 2, radius `card` | Every menu. |
| `Item` neutral | `fg`, hover `tint` | Default action. |
| `Item` danger | `danger-ink`, hover `tint` | Delete, remove, leave. |
| Checked item | `accent-ink` indicator | A setting the viewer toggles. |
| Selected radio | `accent-ink` dot | One of a set. |

Sizes `sm` (`sizing.control.sm` rows) and `md` (`sizing.control.md`). Item radius `sm`; item inline padding `spacing.inset-control`.

## States

| State | What changes |
|---|---|
| Open | `motion.duration.base` with `enter`: fade and a short translate from the trigger side. Closed: `fast` with `exit`. |
| Highlighted | `tint` ground (Radix `data-highlighted`), follows the pointer and arrow keys. |
| Focus-visible | The highlight is the focus indicator on items; the trigger takes `focus-ring`. |
| Checked | Indicator visible, `accent-ink`. |
| Disabled | `fg-subtle`, skipped by typeahead, not highlightable. |
| Submenu open | Parent item stays highlighted. |

## Tokens

- Colour roles `raised`, `border`, `fg`, `fg-muted`, `fg-subtle`, `tint`, `accent-ink`, `danger-ink`.
- `sizing`: `control` sm, md (rows), `icon.sm`. `spacing`: `inset-control`, `gap-inline`.
- `radius`: `card` (panel), `sm` (item). `border`: `divider`. `shadow`: elevation 2.
- Type `label` (item text is `body-sm` at weight 500), `overline` (group label), `mono` (shortcut).
- `motion`: `base`, `fast`, easings `enter`, `exit`. z `popover`.

## Accessibility

- Radix DropdownMenu: trigger has `aria-haspopup="menu"` and `aria-expanded`; content is `role="menu"` with `menuitem`, `menuitemcheckbox`, `menuitemradio`.
- Enter, Space or ArrowDown opens; arrows move; ArrowRight opens a submenu, ArrowLeft closes it; Home and End jump; typeahead jumps by `textValue`; Escape closes and returns focus.
- Focus is trapped while open; the page behind is inert.
- A trigger that is an icon button must carry its label.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger`, `Item` and `SubTrigger`.
- `useDropdownMenu()` returns `{ size }` and the open state, so a part written in an app can read it.
- `menuStyles`, the `tv()` definition, is exported: `tv({ extend: menuStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do put the destructive item last, after a separator, with `tone="danger"`.
- Do show shortcuts with `Shortcut` where one exists.
- Do keep a menu to about 8 items; longer lists need [command](command.md).
- Don't put a form inside a menu; use a [popover](popover.md).
- Don't nest more than one submenu level.
- Don't use it to navigate between pages; use links or tabs.

## In the workbench

Stories: basic, with icons and shortcuts, groups with labels, checkbox items, radio group, submenu, danger item, disabled item, long list scrolling, collision flip at each edge. States: open, highlighted, checked, disabled. Axes: themes by modes, RTL (submenu opens to the left), compact density (`size="sm"`), reduced motion, more contrast.
