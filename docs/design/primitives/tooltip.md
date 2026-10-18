# Tooltip

A short, non-interactive text label that names or describes a control on hover and keyboard focus.

## Anatomy

```
        +------------------+
        | (1) Mute   (2) M |
        +--------v---------+   (3) arrow
              [ icon ]         (4) trigger
```

| # | Part | Notes |
|---|---|---|
| 1 | Content | One line of `caption`-size text, 20 rem max width (a component measure), wraps beyond that. |
| 2 | Shortcut | Optional [kbd](kbd.md) hint. |
| 3 | Arrow | Same fill as the bubble. |
| 4 | Trigger | The one focusable element described. |

## API

```ts
// types.ts
import type { Align, Side } from '../../types';
```

```ts
// A tooltip has one look and one size; its own props are placement only.
interface TooltipContentProps extends Omit<ComponentPropsWithRef<typeof Tooltip.Content>, 'side' | 'align'> { // Radix Tooltip
  side?: Side;            // default 'block-start'
  align?: Align;          // default 'center'
}
// Parts: Tooltip.Provider (delayDuration 400, skipDelayDuration 300), Tooltip.Root, .Trigger, .Content, .Arrow
```

A shortcut is a [kbd](kbd.md) child of `Tooltip.Content`. The root is the one place a `Tooltip.Provider` is mounted. `side` and `align` are the shared `Side` and `Align`, mapped to Radix's physical sides by direction. Today's convenience `<Tooltip content={...}>` and the `Tooltip*` flat exports are replaced by these parts; a pattern may wrap them again if the call site repeats.

```tsx
<Tooltip.Root>
  <Tooltip.Trigger asChild><IconButton aria-label="Mute"><VolumeX /></IconButton></Tooltip.Trigger>
  <Tooltip.Content>Mute <Kbd>M</Kbd></Tooltip.Content>
</Tooltip.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| Default | `fg` ground, `bg` text, radius `sm` | Always. The inverted ground reads on every surface and on video. |

Text is `caption` at weight 600. Padding is a compact box around the text, tighter than any `spacing` role, so it is a component measure. There is no size axis.

## States

| State | What changes |
|---|---|
| Closed | Not in the DOM. |
| Delayed open | After 400 ms on pointer; instant on keyboard focus; instant when moving between tooltips within 300 ms. |
| Open | `motion.duration.base` with `enter`: fade and a short move. |
| Closing | `fast` with `exit`. |
| Dismissed | Escape, pointer leave, scroll or press closes it. |
| Disabled trigger | Does not fire; wrap in a focusable span only to explain why. |
| Reduced motion | Opacity only. |

## Tokens

- Colour roles `fg`, `bg`. `radius`: `sm`.
- Type `caption`, `mono` for the shortcut. `motion`: `base`, `fast`, easings `enter`, `exit`. z `tooltip`.

## Accessibility

- Radix Tooltip: content is `role="tooltip"`, the trigger gets `aria-describedby`.
- It shows on keyboard focus, hides on Escape, and stays open while hovered (WCAG 1.4.13).
- A tooltip describes; it does not name. An icon-only control still needs its own `aria-label` ([icon-button](icon-button.md) does both).
- No interactive content, no links, no buttons.
- Not available on touch; never the only place information lives.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger` and `Content`.
- `useTooltip()` returns `{ open }`, so a part written in an app can read it.
- `tooltipStyles`, the `tv()` definition, is exported: `tv({ extend: tooltipStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do keep it to a few words, sentence case.
- Do show the shortcut with a [kbd](kbd.md) child.
- Do mount one `Tooltip.Provider` at the root so the delay is shared.
- Don't put anything clickable inside; use a [popover](popover.md).
- Don't use it for errors or required information.
- Don't attach it to non-focusable elements.

## In the workbench

Stories: each `Side` (4), with shortcut, long text wrapping, on an icon button, on a disabled control with a wrapper, collision flip, a group-delay demo moving across three triggers. States: delayed, open, closing. Axes: themes by modes (it inverts per mode), RTL, reduced motion, more contrast.
