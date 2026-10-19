# Input

A single-line text field, with optional adornments at either end.

## Anatomy

```
   +----------------------------------------+
   | (1) o | (2) value or placeholder | (3) x |
   +----------------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | Start adornment | Icon or text (a currency, a protocol), non-interactive or an [icon-button](icon-button.md). |
| 2 | Native input | The editable text, `body` or `body-sm` by size. |
| 3 | End adornment | Clear button, a show-password toggle, a unit. |

## API

```ts
// types.ts
import type { ControlSize } from '@vp/design-tokens';
import type { FillOption, ShapeOption } from '../../types';

export type InputFill = Extract<FillOption, 'outline' | 'soft'>;
export type InputSize = ControlSize;
export type InputShape = Extract<ShapeOption, 'text' | 'pill'>;
```

```ts
interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  variant?: InputFill;   // default 'outline'
  size?: InputSize;      // default 'md'
  shape?: InputShape;    // default 'text' (the control radius); 'pill' forces fully round
}
// Parts: Input (single element), InputGroup.Root (takes variant, size, shape), InputGroup.Start, InputGroup.End
```

`Input` is one element with native props (the native numeric `size` is omitted). Adornments need a box around it, so they use `InputGroup`; the group owns `variant`, `size` and `shape` and the inner `Input` takes none. `Select` and `Textarea` use the same `InputFill` and `InputSize`. The old `filled` variant is `soft`. Inside a `Field`, `id`, `aria-describedby` and `aria-invalid` come from `useFieldControl()`, as today. Today's `Input` takes `size` only.

```tsx
<InputGroup.Root variant="soft">
  <InputGroup.Start><Icon><Search /></Icon></InputGroup.Start>
  <Input type="search" aria-label="Search" />
  <InputGroup.End><IconButton aria-label="Clear"><X /></IconButton></InputGroup.End>
</InputGroup.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `outline` | `surface` ground, `border-strong` outline | Forms. |
| `soft` | `tint` ground, no outline until focus | The search field, toolbars, inline edits. |

| Size | Height | Type |
|---|---|---|
| `sm` | `sizing.control.sm` | `body-sm` |
| `md` | `sizing.control.md` | `body` |
| `lg` | `sizing.control.lg` | `body` |

`shape="text"` uses radius role `control`; `pill` is fully round in every theme. Inline padding is `spacing.inset-control`, adornment gap `gap-inline`.

## States

| State | What changes |
|---|---|
| Rest | Roles above; placeholder `fg-subtle`. |
| Hover | Outline stays; `outline` ground gains `tint`. |
| Focus-visible | Outline becomes `focus-ring` at `border.focus` width, plus an `accent-soft` halo. |
| Disabled | `tint` ground, `fg-subtle` text, `cursor: not-allowed`. |
| Read-only | No halo; text `fg`; keeps outline. |
| Invalid | Outline `danger-ink`, error text from the field. |
| Loading | A [spinner](spinner.md) in `InputGroup.End`; the input stays editable. |

## Tokens

- Colour roles `surface`, `tint`, `border-strong`, `fg`, `fg-subtle`, `focus-ring`, `accent-soft`, `danger-ink`.
- `sizing`: `control` sm, md, lg, `icon.sm`. `spacing`: `inset-control`, `gap-inline`.
- `border`: `control`, `focus`. `radius`: `control`, `sm`.
- Type `body`, `body-sm`, `mono` with `tabular-nums` for `inputMode="numeric"` fields when the design says so. `motion`: `fast`.

## Accessibility

- Native `<input>`; the browser provides the role by `type`.
- Always labelled (a Field or `aria-label`); the placeholder is a hint, never a label.
- `autocomplete`, `inputMode` and `enterKeyHint` set for the task so mobile keyboards fit.
- Adornment buttons are real buttons with labels and sit outside the tab trap's way (they follow the input in tab order).
- Font size is never below 16 px on touch, to avoid zoom on focus: `md` on coarse pointers is 16 px.

## Extension points

- `className` on `Input` and every `InputGroup` part, merged with `cn`; `asChild` on `InputGroup.Start` and `InputGroup.End`.
- `useInputGroup()` returns `{ variant, size, shape }`, so an adornment written in an app can read them.
- `inputStyles`, the `tv()` definition, is exported: `tv({ extend: inputStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do set `type`, `inputMode` and `autocomplete`.
- Do use `InputGroup.End` for clear and reveal, with labels.
- Do put validation messages in the Field, not the input.
- Don't use a placeholder as the label.
- Don't colour the outline by hand for state.
- Don't use `shape="pill"` next to `text`-shaped controls in the same row.

## In the workbench

Stories: each variant (2) and size (3), with each adornment, password with reveal, search with clear, number with unit, long value truncation, RTL with a Latin value (direction isolation). States: rest, hover, focus-visible, disabled, read-only, invalid, loading. Axes: themes by modes, compact density, more contrast, 320 px width.
