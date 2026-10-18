# Textarea

A multi-line text field that can grow with its content.

## Anatomy

```
   +----------------------------------------+
   | (1) multi-line text                    |
   |                                        |
   |                              (2) 12/500|
   +--------------------------------(3)-----+
```

| # | Part | Notes |
|---|---|---|
| 1 | Native textarea | Padding `spacing.inset-control`. |
| 2 | Counter | Optional, `caption` in `fg-muted`, `tabular-nums`; becomes `danger-ink` past the limit. |
| 3 | Resize handle | Native, vertical only. |

## API

```ts
// types.ts
import type { InputFill, InputSize } from '../input/types';

export type TextareaFill = InputFill;
export type TextareaSize = InputSize;
```

```ts
interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  variant?: TextareaFill;   // 'outline' | 'soft'; default 'outline'
  size?: TextareaSize;      // font size and minimum rows (2, 3, 5)
  autoGrow?: boolean;       // grow with content up to the CSS max-height, then scroll
}
```

Inside a `Field` the control props arrive from context, as today. A character counter is a `Field.Hint`, not a part of this primitive. Today's `Textarea` has no `variant` or `size`; the target aligns it with [input](input.md), reusing its fill and size aliases. There is no `shape`: a pill multi-line field would be wrong, so the radius is always `sm`.

```tsx
<Textarea variant="soft" size="sm" autoGrow placeholder="Add a comment" />
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `outline` | `surface`, `border-strong` | Forms: descriptions, notes. |
| `soft` | `tint`, no outline until focus | The comment composer, inline replies. |

| Size | Type | Min rows |
|---|---|---|
| `sm` | `body-sm` | 2 |
| `md` | `body` | 3 |
| `lg` | `body` | 5 |

## States

| State | What changes |
|---|---|
| Rest | Placeholder `fg-subtle`. |
| Hover | `outline` ground gains `tint`. |
| Focus-visible | Outline `focus-ring` at `border.focus` width with the `accent-soft` halo. |
| Disabled | `tint` ground, `fg-subtle`, not resizable. |
| Read-only | No halo, keeps outline. |
| Invalid | Outline `danger-ink`; counter `danger-ink` when over the limit. |
| Loading | Not applicable; disable instead while saving. |

## Tokens

- Colour roles `surface`, `tint`, `border-strong`, `fg`, `fg-muted`, `fg-subtle`, `focus-ring`, `accent-soft`, `danger-ink`.
- `spacing`: `inset-control`. `border`: `control`, `focus`. `radius`: `sm`.
- Type `body`, `body-sm`, `caption`. `motion`: `fast` (the height change does not animate when auto-growing, to avoid caret lag).

## Accessibility

- Native `<textarea>`; labelled by a Field or `aria-label`.
- The counter is not read on every keystroke: it is `aria-live="off"` and a separate polite announcement fires at 90 percent and at the limit.
- `maxLength` is enforced by the browser; the visible counter mirrors it.
- Enter inserts a newline; a submit shortcut (Cmd or Ctrl plus Enter) is the caller's and is shown in the hint text.

## Do and don't

- Do use `autoGrow` for comments, with a counter in the `Field.Hint` when a limit exists.
- Do show a counter when a limit exists.
- Do set `rows` through `size`, not by fixed pixel height.
- Don't turn off resize without a reason; it is a low-vision aid.
- Don't use it for a single line; use [input](input.md).
- Don't submit on bare Enter in a multi-line field.

## In the workbench

Stories: each variant (2) and size (3), auto-grow from one line to the cap, with counter under and over the limit, long unbroken word wrapping, pasted multi-paragraph text. States: rest, hover, focus-visible, disabled, read-only, invalid. Axes: themes by modes, RTL with mixed text, compact density, more contrast, 320 px width.
