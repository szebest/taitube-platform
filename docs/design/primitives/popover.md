# Popover

A floating panel anchored to a trigger that holds interactive content, such as a small form, a picker or a list of options.

## Anatomy

```
   [ (1) Trigger ]
        ^ (4) arrow (optional)
   +---------------------------+
   | (2) Content               |
   |   inputs, buttons, text   |
   |                    (3) x  |
   +---------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Popover.Trigger` | Any button; `asChild`. |
| 2 | `Popover.Content` | `raised` panel, radius `card`, elevation-2. |
| 3 | `Popover.Close` | Optional close, an [icon-button](icon-button.md). |
| 4 | `Popover.Arrow` | Optional, fill `raised`. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';
import type { Align, Side } from '../../types';

export type PopoverSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
```

```ts
interface PopoverContentProps extends Omit<ComponentPropsWithRef<typeof Popover.Content>, 'side' | 'align'> { // Radix Popover
  size?: PopoverSize;     // 240, 320, 400 px width; default 'md'
  side?: Side;            // default 'block-end'
  align?: Align;          // default 'center'
}
// Parts: Popover.Root, .Trigger, .Anchor, .Content, .Arrow, .Close
```

`side` and `align` are the shared `Side` and `Align`, mapped to Radix's physical sides by direction. `sideOffset` (default `spacing.gap-inline`) and `collisionPadding` are Radix props. Widths are component measures (no sizing token covers a panel width). `Popover` is new. For a list of actions use [dropdown-menu](dropdown-menu.md); for a read-only preview on hover use [hover-card](hover-card.md); for a description use [tooltip](tooltip.md).

```tsx
<Popover.Root>
  <Popover.Trigger asChild><Button variant="outline">Share</Button></Popover.Trigger>
  <Popover.Content size="md">
    <Field.Root><Field.Label>Link</Field.Label><Field.Control asChild><Input readOnly value={url} /></Field.Control></Field.Root>
    <Popover.Close asChild><Button>Done</Button></Popover.Close>
  </Popover.Content>
</Popover.Root>
```

## Variants and sizes

| Size | Width | When to use |
|---|---|---|
| `sm` | 240 px | A short option list or a confirm. |
| `md` | 320 px | A form of a few fields, a share panel. |
| `lg` | 400 px | A notifications list, a picker with preview. |

One visual variant: roles `raised`, `border`, `fg`, elevation 2. Padding `spacing.inset-control`. A popover never picks a colour of its own. On compact, the pattern layer swaps it for a [drawer](drawer.md).

## States

| State | What changes |
|---|---|
| Open | `motion.duration.base` with `enter`: fade and a short move from the trigger side. |
| Closed | `fast` with `exit`. |
| Trigger open | The trigger shows `aria-expanded`; ghost buttons keep `tint-strong` while open. |
| Focus-visible | `focus-ring` on the focused control; focus starts on the first focusable. |
| Modal | `modal` makes the page behind inert (no scrim); the default is non-modal. |
| Reduced motion | Opacity only. |

## Tokens

- Colour roles `raised`, `border`, `fg`, `fg-muted`, `focus-ring`.
- `spacing`: `inset-control`, `gap-stack`. `radius`: `card`. `border`: `divider`, `focus`, `focus-offset`. `shadow`: elevation 2.
- Type `body-sm` (content owns the rest). `motion`: `base`, `fast`, easings `enter`, `exit`. z `popover`.

## Accessibility

- Radix Popover: trigger carries `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`; content is `role="dialog"`, non-modal by default.
- Enter or Space opens; Tab moves inside; Escape closes and returns focus to the trigger; outside click closes.
- Give the content an accessible name: a heading with `aria-labelledby`, or `aria-label`.
- Content is portalled but remains next to the trigger in the tab order (Radix manages it).

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger`, `Anchor`, `Close` and `Content`.
- `usePopover()` returns `{ size, open }`, so a part written in an app can read it.
- `popoverStyles`, the `tv()` definition, is exported: `tv({ extend: popoverStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do use it when the panel has controls the viewer will interact with.
- Do cap the width with `size`, never a fixed pixel style.
- Do give it a name through a heading or label.
- Don't open it on hover; that is a hover card, and not reachable by keyboard or touch.
- Don't use it for menus of actions.
- Don't place another popover or menu that needs to outlive it inside; close first.

## In the workbench

Stories: size sm, md, lg; with a form; with arrow; each `Side` (4) and `Align` (3); collision flip near edges; modal; controlled open; opening in a scroll container. Axes: themes by modes, RTL (`start` and `end` alignment), compact density, reduced motion, 320 px width.
