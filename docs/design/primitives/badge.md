# Badge

A small static label that classifies the thing next to it: a quality, a state, a count, never an action.

## Anatomy

```
   [ (1) 4K ]     [ (1)(2) LIVE ]     [ NEW (3) ]
```

| # | Part | Notes |
|---|---|---|
| 1 | Container | `overline`-weight text on a role ground, radius `xs`, inline padding `gap-inline` at `md`. |
| 2 | Dot or icon | The live pulse dot, or an `Icon` at `IconSize` `sm`; status tones always carry one. |
| 3 | Label | Uppercase by convention, short (up to about 12 characters). |

## API

```ts
// types.ts
import type { SizeOption, ToneOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type BadgeFill = Exclude<FillOption, 'ghost' | 'plain'> | 'scrim';
export type BadgeTone = ToneOption;
export type BadgeSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface BadgeProps extends ComponentPropsWithRef<'span'> {
  variant?: BadgeFill;   // default 'soft'
  tone?: BadgeTone;      // default 'neutral'
  size?: BadgeSize;      // default 'md'
}
```

An icon or dot is a child. Today's `Badge` has a `variant` of `neutral | accent | outline | success | warning | danger`; those colours move to `tone`, and `variant` becomes the fill style. `tone="live"` forces the solid look and the pulsing dot. `scrim` widens the shared fill union because no shared fill means "dark glass over media"; if a second component needs it, it moves into `FillOption`.

```tsx
<Badge tone="live"><Icon size="sm"><Radio /></Icon>Live</Badge>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `solid` | `accent` and `on-accent`, or `live` and `on-live` | The one emphasised label on a card: LIVE, PREMIERE. |
| `soft` | `accent-soft` and `accent-ink`; or `tint-strong` with `fg` for neutral; or `tint` with a `*-ink` text | Default metadata badge. |
| `outline` | `accent` ring with `accent-ink` text; `border-strong` with `fg` for neutral | Quiet badge on a surface. |
| `scrim` | `scrim` and `fg` text (white over media) | On top of a thumbnail: 4K, NEW. |

Status tones (`success`, `warning`, `danger`, `info`) have no fill role: they use `tint` as the ground, the matching `*-ink` for text and icon. Sizes: `sm` is `caption` type, `md` is `overline` type; the height is the type's line height plus block padding (no sizing token covers a label chip).

## States

| State | What changes |
|---|---|
| Rest | The variant roles. |
| Hover, pressed, focus | None: a badge is not interactive. If it must be, use [chip](chip.md). |
| Live | The dot pulses; the pulse stays under reduced motion, as the guide requires. |
| Disabled, loading, invalid | Not applicable. |

## Tokens

- Colour roles `tint`, `tint-strong`, `accent`, `on-accent`, `accent-soft`, `accent-ink`, `live`, `on-live`, `scrim`, `border-strong`, `success-ink`, `warning-ink`, `danger-ink`, `info-ink`.
- `radius`: `xs`. `border`: `control` (outline fill).
- `spacing`: `gap-inline` between dot or icon and label. `sizing`: `icon.sm` for the icon.
- Type `overline` and `caption`, with `tabular-nums` for counts.
- `motion`: the live pulse, 1.6 s, is not a duration token.

## Accessibility

- A `span`; no role. Meaning must not live in colour alone, so status tones always include an icon and a word.
- `live` is announced as text "Live"; the dot is `aria-hidden`.
- Text over `scrim` meets 4.5:1 because `scrim` is dark in every mode.
- A count badge on an icon button is labelled by the button ("Notifications, 3 new"), not by the badge.

## Do and don't

- Do keep to one or two words.
- Do reserve `tone="live"` and red for live and recording.
- Do use `scrim` for badges over thumbnails.
- Don't use `accent` for status; accent is the viewer's own action or position.
- Don't make a badge clickable; use a chip or button.
- Don't rely on the tone colour for meaning without the icon.

## In the workbench

Stories: one per variant (4) crossed with tones (7) in a matrix, `live` with pulse, with icon, with count in `tabular-nums`, over a thumbnail with `scrim`, long label truncation, both sizes. Axes: themes by modes (Nocturne warning is coral and must show its icon), RTL, more contrast, reduced motion (pulse continues).
