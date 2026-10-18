# Spinner

An indeterminate ring that says something is working when the time or the total is unknown.

## Anatomy

```
        .-""-.
       /  (1) \      (2) status text, visually hidden
       \      /
        '-..-'
```

| # | Part | Notes |
|---|---|---|
| 1 | Ring | A Lucide loader at stroke 1.75, `fg-muted` by default. |
| 2 | Status text | The accessible name, read instead of the animation. |

## API

```ts
// types.ts
import type { IconSize, ToneOption } from '@vp/design-tokens';

export type SpinnerSize = IconSize;
export type SpinnerTone = Extract<ToneOption, 'neutral' | 'accent'>;
```

```ts
interface SpinnerProps extends ComponentPropsWithRef<'span'> {
  size?: SpinnerSize;      // sizing.icon; default 'md'
  tone?: SpinnerTone;      // default 'neutral'; 'accent' for the viewer's own wait
}
```

The accessible name is a visually hidden child (`<Spinner>Uploading</Spinner>`), or none when the spinner sits beside text that already says it. Today's `Spinner` requires a `label` prop; the target moves it to a child, so no copy is a prop. Sizes are the `sizing.icon` steps; a section that is loading uses `lg` centred in a block that holds its final size.

```tsx
<Spinner size="sm"><VisuallyHidden>Saving</VisuallyHidden></Spinner>
```

## Variants and sizes

| Tone | Roles | When to use |
|---|---|---|
| `neutral` | `fg-muted` | Default, inline, in buttons. |
| `accent` | `accent-ink` | A wait that is the viewer's own action, like an upload. |

Sizes `sm` (`sizing.icon.sm`, inside a button or input end), `md` (`sizing.icon.md`), `lg` (`sizing.icon.lg`).

## States

| State | What changes |
|---|---|
| Spinning | Rotates 360 degrees every 0.8 s, linear. |
| Reduced motion | Replaced by a slow opacity pulse; the ring does not rotate. |
| Hover, focus, pressed, disabled, invalid | Not applicable. |

## Tokens

- Colour roles `fg-muted`, `accent-ink`. `sizing`: `icon` sm, md, lg.
- Radius and type: none. `motion`: `fast` for fades in and out; the rotation (0.8 s linear) is a continuous animation, not a duration token.

## Accessibility

- `role="status"` with the name as text content; polite, so it is announced once when it appears.
- Never the only signal: pair with text where the wait is long ("Processing your video").
- Pairing with a button: the button sets `aria-busy` and keeps its label; the spinner inside it is `aria-hidden`.
- Do not use more than one status spinner in a region.

## Do and don't

- Do prefer [skeleton](skeleton.md) for page and card loading, and a spinner for actions.
- Do give long waits a message and, when known, a [progress](progress.md) bar.
- Do keep it centred in a block that holds its final size.
- Don't use it for known progress.
- Don't show it for under about 300 ms; delay it.
- Don't colour it by hand.

## In the workbench

Stories: each size and tone, inside a button, at the end of an input, centred in a section, with visible text, reduced motion variant. Axes: themes by modes, RTL, more contrast.
