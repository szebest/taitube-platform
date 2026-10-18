# Callout

An inline, persistent message that sits in the page flow beside the content it concerns.

## Anatomy

```
   +----------------------------------------------+
   | (1) icon  (2) Title                          |
   |           (3) Body text, up to a few lines   |
   |           (4) [Action]                       |
   +----------------------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Callout.Icon` | `Icon` at `IconSize` `md`, in the tone's ink. |
| 2 | `Callout.Title` | `label` style, optional. |
| 3 | `Callout.Body` | `body-sm`, up to 68 ch wide. |
| 4 | `Callout.Action` | Optional link or [button](button.md). |

## API

```ts
// types.ts
import type { ToneOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type CalloutFill = Extract<FillOption, 'soft' | 'outline'>;
export type CalloutTone = Exclude<ToneOption, 'live'>;
```

```ts
interface CalloutRootProps extends ComponentPropsWithRef<'div'> {
  variant?: CalloutFill;   // default 'soft'
  tone?: CalloutTone;      // default 'accent'
}
// Parts: Callout.Root, .Icon, .Title, .Body, .Action
```

The root shares `tone` and `variant` with the parts through context. New in 95 (the stand-in is `.tt-callout`).

```tsx
<Callout.Root tone="warning">
  <Callout.Icon><AlertTriangle /></Callout.Icon>
  <Callout.Title>Processing is slow</Callout.Title>
  <Callout.Body>Your 4K upload may take a few minutes.</Callout.Body>
</Callout.Root>
```

## Variants and sizes

| Variant and tone | Roles | When to use |
|---|---|---|
| `soft`, `accent` | `accent-soft`, `fg`, icon `accent-ink` | A tip or editorial note. |
| `soft`, `neutral` | `tint`, `fg` | Plain information. |
| `soft`, `success` / `warning` / `danger` / `info` | `tint`, `fg`, icon and title in the matching `*-ink` | A status that always carries its icon. |
| `outline` | transparent, `border-strong`, same inks | On a `surface` ground where a tint would blur. |

Radius `card`. Padding is `spacing.inset-card`, gap between parts `gap-inline`. No size axis.

## States

| State | What changes |
|---|---|
| Rest | The roles above. |
| Appearing | Fades in over `base`; none under reduced motion. |
| Dismissed | If the callout is dismissible, the close is an [icon-button](icon-button.md) child and the content collapses over `base`. |
| Hover, focus, pressed | Only on its action. |
| Disabled, loading, invalid | Not applicable. |

## Tokens

- Colour roles `accent-soft`, `tint`, `border-strong`, `fg`, `fg-muted`, `accent-ink`, `success-ink`, `warning-ink`, `danger-ink`, `info-ink`.
- `spacing`: `inset-card`, `gap-inline`. `radius`: `card`. `border`: `control` (the outline fill). `sizing`: `icon.md`.
- Type `label`, `body-sm`. `motion`: `base`.

## Accessibility

- `role="status"` for `info`, `success`, `neutral`, `accent` messages that appear after load; `role="alert"` for `danger` that appears dynamically; none for static content, which is just text.
- Status is never colour alone: the icon and the title say it.
- Contrast: each `*-ink` meets 4.5:1 on `tint` in every theme and mode.
- Actions are real links or buttons, in reading order.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Callout.Title`, `Callout.Body` and `Callout.Action`.
- `useCallout()` returns `{ tone, variant }`, so a part written in an app can read it.
- `calloutStyles`, the `tv()` definition, is exported: `tv({ extend: calloutStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do put the callout next to the thing it explains.
- Do keep it to a title and a few lines.
- Do give every status tone its icon.
- Don't use it for a transient result; use a [toast](toast.md).
- Don't stack several callouts in one region.
- Don't use `accent` for a status; it is for tips.

## In the workbench

Stories: each tone (6) in `soft` and `outline` (12), with action, without title, long body wrapping at 68 ch, dismissible. Axes: themes by modes (Nocturne warning is coral), RTL, compact density, more contrast, 320 px width.
