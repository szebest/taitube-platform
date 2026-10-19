# Checkbox

A binary or tri-state choice that is applied together with a form, not instantly.

## Anatomy

```
   [ (1) ] (2) Label text
     |
     (3) check or dash
```

| # | Part | Notes |
|---|---|---|
| 1 | Box | `sizing.icon.md`, radius `xs`, `border.control` wide in `border-strong`. |
| 2 | Label | A [label](label.md), clickable, `body` or `body-sm`. |
| 3 | Indicator | `Check` or `Minus` icon sized to the box, stroke 3. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type CheckboxSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface CheckboxProps extends ComponentPropsWithRef<typeof Checkbox.Root> { // Radix Checkbox
  size?: CheckboxSize;                                                         // default 'md'
}
```

`checked` accepts `'indeterminate'`, as in Radix. Inside a `Field` the id, `aria-describedby`, `aria-invalid` and `required` arrive from context, as today; there is no `tone`, because invalid is the field's state.

```tsx
<Field.Root orientation="horizontal">
  <Field.Control asChild><Checkbox defaultChecked /></Field.Control>
  <Field.Label>Notify me about replies</Field.Label>
</Field.Root>
```

## Variants and sizes

| Variant or size | Roles | When to use |
|---|---|---|
| Default | `accent`, `on-accent` | Selection. |
| Invalid (from `Field`) | `danger-ink` outline | Set by the field, never by hand. |
| `size="md"` | box `sizing.icon.md` | Forms. |
| `size="sm"` | box `sizing.icon.sm` | Dense tables in Studio; hit area still `sizing.layout.touch-target` on touch. |

## States

| State | What changes |
|---|---|
| Rest | `surface` ground, `border-strong` outline. |
| Hover | Outline stays; ground `tint`; `fast`. |
| Focus-visible | `focus-ring`, `border.focus` wide with `border.focus-offset`. |
| Pressed | `tint-strong` ground. |
| Checked | `accent` ground and border, `on-accent` icon, pop-in with `motion.duration.base` and `enter`. |
| Indeterminate | Same as checked with a dash. |
| Disabled | `tint` ground, `fg-subtle` icon and label, no pointer events. |
| Invalid | Outline `danger-ink`; message from the field. |

## Tokens

- Colour roles `surface`, `border-strong`, `tint`, `tint-strong`, `accent`, `on-accent`, `danger-ink`, `focus-ring`, `fg-subtle`.
- `sizing`: `icon` sm, md (the box), `layout.touch-target`. `border`: `control`, `focus`, `focus-offset`.
- `radius`: `xs`. `spacing`: `gap-inline` to the label. Type `body-sm` for the label.
- `motion`: `fast`, `base`, easing `enter`.

## Accessibility

- Radix Checkbox renders `role="checkbox"` with `aria-checked` (`mixed` for indeterminate) and a hidden native input for forms.
- Space toggles. Tab reaches it; it is not in a roving group.
- Always labelled: a [label](label.md) with `htmlFor`, or `aria-label`.
- The check is a shape, not just a colour, so state survives forced colours and more contrast.

## Do and don't

- Do use it for "select many" and for consent in a form.
- Do use `indeterminate` only for a parent of a partly selected set.
- Do wrap in a [field](field.md) so the error and hint are linked.
- Don't use it for instant on/off settings; use a [switch](switch.md).
- Don't use it for a choice of exactly one; use a radio group via [segmented-control](segmented-control.md) or a [select](select.md).
- Don't shrink the label's click area; the label belongs to the hit target.

## In the workbench

Stories: unchecked, checked, indeterminate, each in rest, hover, focus-visible, pressed, disabled and invalid; both sizes; with label, with a hint inside a field; a select-all table header controlling rows. Axes: themes by modes, RTL (label side), compact density, more contrast.
