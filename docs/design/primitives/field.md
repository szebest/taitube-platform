# Field

The wrapper that ties one control to its label, hint and error, and passes the ids to the control.

## Anatomy

```
   (1) Label  (2) *
   +--------------------------------+
   | (3) control                    |
   +--------------------------------+
   (4) Description
   (5) (!) Error message
```

| # | Part | Notes |
|---|---|---|
| 1 | `Field.Label` | A [label](label.md) linked with `htmlFor`. |
| 2 | Required mark | Visual `*` plus the text "required" from the catalogue, hidden from the visual flow. |
| 3 | Control | One of `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Slider`. |
| 4 | `Field.Hint` | `caption` in `fg-muted`. |
| 5 | `Field.Error` | `caption` in `danger-ink` with an alert icon; replaces nothing, it adds. |

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';
import type { Orientation } from '../../types';

export type FieldOrientation = Orientation;
export type FieldSize = ControlSize;
```

```ts
interface FieldRootProps extends ComponentPropsWithRef<'div'> {
  orientation?: FieldOrientation;  // 'vertical' (label above, default); 'horizontal' for checkbox and switch rows
  size?: FieldSize;                // forwarded to the control; default 'md'
  invalid?: boolean;               // marks the control invalid
  required?: boolean;
}
// Parts: Field.Root, Field.Label, Field.Control (asChild over the one control), Field.Hint, Field.Error, and useFieldControl()
//   -> { id, 'aria-describedby', 'aria-invalid', 'aria-required' }
```

The root holds the whole-field options and shares them through context. A label, hint and error are parts, not strings. Today's `Field` takes `label`, `description` and `error` as props and `orientation`; the target renames `description` to `Hint` and keeps `orientation`, now typed as the shared `Orientation`. `@vp/forms` renders `Field` and feeds `invalid`. The required mark's text is `required` from `useUiCopy()` ([ui-copy-provider](ui-copy-provider.md)).

`Field.Control` wires `id`, `aria-describedby`, `aria-invalid` and `aria-required` onto its one child; a control that reads `useFieldControl()` itself (as `Input` does today) needs no wrapper.

```tsx
<Field.Root invalid={!!error} required>
  <Field.Label>Title</Field.Label>
  <Field.Control asChild><Input /></Field.Control>
  <Field.Hint>Up to 100 characters.</Field.Hint>
  {error && <Field.Error>{error}</Field.Error>}
</Field.Root>
```

## Variants and sizes

| Orientation | Roles | When to use |
|---|---|---|
| `vertical` | `fg`, `fg-muted`, `danger-ink` | Text inputs, textareas, selects: label above. |
| `horizontal` | same | Checkbox and switch: control at the start, label beside it. |

`size` follows the control: `sizing.control` sm, md, lg. Spacing between parts is `spacing.gap-inline` (a tighter step is not needed in `sm`; the spacing set already tightens under compact).

## States

| State | What changes |
|---|---|
| Rest | Label `fg`, hint `fg-muted`. |
| Hover, focus | Owned by the control. The label does not change. |
| Required | Mark appended to the label. |
| Invalid | `data-invalid`; the control gets `aria-invalid`; the error appears, the control outline becomes `danger-ink`. |
| Disabled | Label and hint `fg-subtle`; the control is disabled. |
| Loading | A control-specific loading state; the field stays. |

## Tokens

- Colour roles `fg`, `fg-muted`, `fg-subtle`, `danger-ink`.
- `sizing`: `control` sm, md, lg (forwarded), `icon.sm` for the error icon. `spacing`: `gap-inline` between parts, `gap-stack` between fields in a form.
- Radius: none of its own. Type `label` (label), `caption` (hint and error).
- `motion`: `fast` for the error's height and opacity, easing `enter`.

## Accessibility

- The label and control are linked by `htmlFor` and an id from `useId`; Radix controls get the id on their button.
- `aria-describedby` lists the hint and the error ids; `aria-invalid` is set only when `invalid` is.
- The error is in a polite live region so it is announced when it appears, and is never colour alone (icon and text).
- Required is conveyed by `aria-required` and text, not just the asterisk.
- Group related controls (radio sets) in a `fieldset` with a `legend`, not repeated Fields.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Field.Control` and `Field.Label`.
- `useField()` returns `{ orientation, size, invalid, required }` (the `useFieldControl()` ids are the control-side slice), so a part written in an app can read it.
- `fieldStyles`, the `tv()` definition, is exported: `tv({ extend: fieldStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do give every control a Field, or an explicit `aria-label`.
- Do word errors as what to do ("Enter a title"), not what failed.
- Do keep descriptions to one line.
- Don't use placeholder text as a label.
- Don't put two controls in one Field.
- Don't style the error by hand; it is the only place `danger-ink` carries a message in a form.

## In the workbench

Stories: vertical and horizontal; with each control (input, textarea, select, checkbox, switch, slider); hint, error, both, required, disabled; long label and error wrapping; the three sizes. Axes: themes by modes, compact density, RTL, more contrast, 320 px width.
