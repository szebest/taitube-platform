# Label

The text that names a form control, clickable so it focuses or toggles that control.

## Anatomy

```
   (1) Display name  (2) *  (3) (optional)
```

| # | Part | Notes |
|---|---|---|
| 1 | Text | `label` type style, `fg`. |
| 2 | Required mark | A `*` in `danger-ink`, `aria-hidden`, with a text equivalent. |
| 3 | Optional hint | "(optional)" in `fg-muted`, from the message catalogue. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type LabelSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface LabelProps extends ComponentPropsWithRef<typeof Label.Root> {  // Radix Label
  size?: LabelSize;              // default 'md'
}
```

`htmlFor` is the native prop. A required or optional hint is not a prop here; `Field.Label` adds the mark and its text (`required`, `optional`) from `useUiCopy()` ([ui-copy-provider](ui-copy-provider.md)). Today's `Label` is a plain `<label>` with a `peer-disabled` rule; the target keeps that and adds `size`.

```tsx
<Label htmlFor="title" size="sm">Title</Label>
```

## Variants and sizes

| Size | Type | When to use |
|---|---|---|
| `md` | `label` | Forms. |
| `sm` | `body-sm` at weight 600 | Dense Studio forms, table filters. |

Roles `fg`, `fg-muted`, `fg-subtle`, `danger-ink`. No variants: a label has one look.

## States

| State | What changes |
|---|---|
| Rest | `fg`. |
| Hover | Cursor `pointer`; no colour change. |
| Focus-visible | None: the label is not focusable; the control shows the ring. |
| Pressed | None; the click is forwarded. |
| Disabled | `fg-subtle`, `cursor: not-allowed`. |
| Invalid | None on the label; the Field shows the error and the control outline. |

## Tokens

- Colour roles `fg`, `fg-muted`, `fg-subtle`, `danger-ink`.
- `spacing`: `gap-inline` before the required mark. Radius: none. Type `label`, `body-sm`. Motion: none.

## Accessibility

- A native `<label>` linked by `htmlFor` or by wrapping the control; this gives the control its accessible name and a larger hit area.
- A required control also sets `required` or `aria-required`; the asterisk is not the signal.
- The mark is `aria-hidden` and a visually hidden "required" follows it ([visually-hidden](visually-hidden.md)).
- Do not hide a visible label with `display: none`; if the design has no visible label, use `aria-label` on the control.

## Do and don't

- Do keep the label short and a noun phrase ("Video title").
- Do put the label above the control (vertical Field) or beside a checkbox or switch.
- Do use sentence case.
- Don't use a placeholder in place of a label.
- Don't truncate; let it wrap.
- Don't make a label a link or a button.

## In the workbench

Stories: both sizes (2), required, optional, disabled, long label wrapping, paired with an input, a checkbox, and a switch (click focuses or toggles). Axes: themes by modes, RTL (mark moves), compact density, more contrast.
