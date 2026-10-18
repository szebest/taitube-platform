# Switch

An on or off setting that takes effect immediately, with no save step.

## Anatomy

```
   Label                 (1)==( 2 )
                          track  thumb
```

| # | Part | Notes |
|---|---|---|
| 1 | Track | Height `sizing.icon.lg` at `md`, `sizing.icon.md` at `sm`; the radius role `control`. |
| 2 | Thumb | Track height less twice the inset; travels the track, mirrored in RTL. |

The label is a separate [label](label.md) or a [field](field.md) with `orientation="horizontal"`.

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type SwitchSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface SwitchProps extends ComponentPropsWithRef<typeof Switch.Root> { // Radix Switch
  size?: SwitchSize;               // default 'md'
}
```

`checked`, `onCheckedChange`, `disabled` and `required` are Radix props. Inside a `Field` the id and description links arrive from context, as today. A pending save is the caller's `disabled` plus a [spinner](spinner.md) beside the switch, so there is no `loading` prop.

```tsx
<Field.Root orientation="horizontal">
  <Field.Label>Autoplay</Field.Label>
  <Field.Control asChild><Switch checked={autoplay} onCheckedChange={setAutoplay} /></Field.Control>
</Field.Root>
```

## Variants and sizes

| Variant or size | Roles | When to use |
|---|---|---|
| Default | on: `accent`, thumb `on-accent`; off: `tint-strong`, thumb `fg` | Every setting. |
| `size="md"` | track height `sizing.icon.lg` | Settings rows. |
| `size="sm"` | track height `sizing.icon.md` | Dense tables, Studio. |

The hit area is at least `sizing.layout.touch-target` under a coarse pointer.

## States

| State | What changes |
|---|---|
| Off, rest | Track `tint-strong`, thumb `fg`, a small inset. |
| On, rest | Track `accent`, thumb `on-accent`. |
| Hover | Off track `border`; on track `accent-hover`. |
| Focus-visible | `focus-ring` around the track, `border.focus` wide with `border.focus-offset`. |
| Pressed | Thumb widens slightly over `motion.duration.instant`. |
| Disabled | Track `tint`, thumb `fg-subtle`. |
| Loading | Thumb shows a [spinner](spinner.md); further input ignored; `aria-busy`. |
| Moving | Thumb travels over `motion.duration.fast` with `settle`; an instant snap under reduced motion. |

## Tokens

- Colour roles `accent`, `accent-hover`, `on-accent`, `tint`, `tint-strong`, `border`, `fg`, `fg-subtle`, `danger`, `focus-ring`.
- `sizing`: `icon` md, lg (track height), `layout.touch-target`. `radius`: `control`. `border`: `focus`, `focus-offset`.
- Type: none. `motion`: `fast`, `instant`, easing `settle`.

## Accessibility

- Radix Switch: `role="switch"` with `aria-checked`, a hidden input for forms.
- Space toggles (Enter also works in Radix). Tab reaches it.
- The label names the setting, not the state ("Autoplay", never "Autoplay on"); state is announced by the role.
- Never use colour alone: the thumb position differs, and more contrast adds a check glyph in the thumb.

## Do and don't

- Do use it for settings that apply on toggle.
- Do disable the switch and show a [spinner](spinner.md) when the change is a network call, and roll back on error with a [toast](toast.md).
- Do align the track at the end in a settings row (`Field` horizontal reverses it).
- Don't use it inside a form that has a Save button; use [checkbox](checkbox.md).
- Don't label it with the action ("Turn on").
- Don't use it for exclusive choices.

## In the workbench

Stories: off, on, each in rest, hover, focus-visible, pressed, disabled and pending (disabled with a spinner); both sizes (2); in a settings row with description; in RTL (thumb direction). Axes: themes by modes (Nocturne track is a rounded rectangle), compact density, reduced motion, more contrast.
