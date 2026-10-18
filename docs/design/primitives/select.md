# Select

A closed list of options opened from a trigger, for choosing exactly one value.

## Anatomy

```
   +--------------------------------+
   | (1) Selected value        (2) v|   trigger
   +--------------------------------+
   +--------------------------------+
   | (3) GROUP LABEL                |
   | (4) Option                  (5)|   (5) check on the selected item
   | (4) Option                     |
   |--- (6) separator --------------|
   +--------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Select.Trigger` | Looks like an [input](input.md); shows `Select.Value` or the placeholder. |
| 2 | Chevron | `Icon` at `IconSize` `sm`, `fg-muted`. |
| 3 | `Select.Label` | `overline`. |
| 4 | `Select.Item` | Row at `sizing.control.md`. |
| 5 | `Select.ItemIndicator` | Check icon at the end. |
| 6 | `Select.Separator` | A [separator](separator.md). |

## API

```ts
// types.ts
import type { InputFill, InputShape, InputSize } from '../input/types';

export type SelectFill = InputFill;
export type SelectSize = InputSize;
export type SelectShape = InputShape;
```

```ts
interface SelectTriggerProps extends ComponentPropsWithRef<typeof Select.Trigger> { // Radix Select
  variant?: SelectFill;    // 'outline' | 'soft'; default 'outline'
  size?: SelectSize;       // same heights as Input
  shape?: SelectShape;     // default 'text'
}
// Parts: Select.Root (value, onValueChange, name), .Trigger, .Value (placeholder), .Content, .Group, .Label,
//   .Item (value), .Separator
```

`SelectFill`, `SelectSize` and `SelectShape` are the `Input` aliases (`Extract<FillOption, 'outline' | 'soft'>`, `ControlSize`, `Extract<ShapeOption, 'text' | 'pill'>`), so the two cannot drift. The check indicator, chevron, viewport and portal are built in. Inside a `Field` the control props come from context, as today. Today the parts are flat (`SelectTrigger`, `SelectItem`) and the trigger takes `size`; the old `filled` variant is `soft`.

```tsx
<Select.Root value={sort} onValueChange={setSort}>
  <Select.Trigger variant="soft"><Select.Value placeholder="Sort by" /></Select.Trigger>
  <Select.Content>
    <Select.Item value="top">Top</Select.Item>
    <Select.Item value="newest">Newest</Select.Item>
  </Select.Content>
</Select.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `outline` | `surface`, `border-strong` | Forms. |
| `soft` | `tint` | Toolbars, sort pickers, the Studio table header. |

Heights match input: `sizing.control` sm, md, lg. The panel uses `raised`, `border`, elevation 2, radius `card`; items radius `sm`.

## States

| State | What changes |
|---|---|
| Rest | Placeholder `fg-subtle`, value `fg`. |
| Hover | Trigger `tint` ground. |
| Focus-visible | Outline `focus-ring` at `border.focus` width with the `accent-soft` halo. |
| Open | Chevron rotates 180 degrees over `motion.duration.fast`; panel `base` with `enter`. |
| Highlighted item | `tint` ground. |
| Selected item | Check in `accent-ink`. |
| Disabled | `tint`, `fg-subtle`. |
| Invalid | Outline `danger-ink`. |

## Tokens

- Colour roles `surface`, `raised`, `tint`, `border`, `border-strong`, `fg`, `fg-muted`, `fg-subtle`, `accent-ink`, `focus-ring`, `accent-soft`, `danger-ink`.
- `sizing`: `control` sm, md, lg, `icon.sm`, `layout.touch-target`. `spacing`: `inset-control`, `gap-inline`.
- `radius`: `control`, `sm` (trigger), `card` (panel), `sm` (items). `border`: `control`, `divider`, `focus`. `shadow`: elevation 2.
- Type `body`, `label`, `overline`. `motion`: `fast`, `base`, easings `enter`, `exit`. z `popover`.

## Accessibility

- Radix Select: trigger `role="combobox"` with `aria-expanded`; list `role="listbox"`, items `role="option"` with `aria-selected`.
- Enter, Space, ArrowDown open; arrows move; typeahead selects by `textValue`; Home and End; Escape closes; Tab leaves.
- A hidden native `<select>` keeps form submission and autofill working.
- Labelled by a Field or `aria-label`.
- On touch, the native picker is not used; the panel is the Radix list, rows at least `sizing.layout.touch-target` high.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Select.Trigger`, `Select.Value` and `Select.Item`.
- `useSelect()` returns `{ variant, size, shape, open }`, so a part written in an app can read it.
- `selectStyles`, the `tv()` definition, is exported: `tv({ extend: selectStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do use it for 5 or more options and one choice.
- Do group long lists with labels.
- Do set a placeholder that is an instruction ("Choose a category").
- Don't use it for 2 to 4 options; use [segmented-control](segmented-control.md).
- Don't use it for multi-select; use [command](command.md) in a [popover](popover.md).
- Don't put actions in it; that is a [dropdown-menu](dropdown-menu.md).

## In the workbench

Stories: each variant (2) and size (3), with groups, with disabled items, long list scrolling, long label truncation, placeholder, preselected, in a Field with an error. States: rest, hover, focus-visible, open, disabled, invalid. Axes: themes by modes, RTL, compact density, reduced motion, 320 px width.
