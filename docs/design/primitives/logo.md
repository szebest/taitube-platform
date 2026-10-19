# Logo

The Taitube mark and lowercase wordmark, in one ink, used in the header and on auth and error surfaces.

## Anatomy

```
   +------+
   | sun  |  taitube
   | (1)  |  (2)
   +------+
```

| # | Part | Notes |
|---|---|---|
| 1 | Mark | A 16:9 frame with a sun rising on its lower edge, one ink. Never a play triangle in a coloured box. |
| 2 | Wordmark | Lowercase `taitube` in the UI face, weight 800, tracking `-0.045em`. |

## API

```ts
// types.ts
import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type LogoVariant = 'lockup' | 'mark' | 'wordmark';
export type LogoSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
export type LogoTone = Extract<ToneOption, 'neutral' | 'accent'>;
```

```ts
interface LogoProps extends ComponentPropsWithRef<'span'> {
  variant?: LogoVariant;   // default 'lockup'
  size?: LogoSize;         // 20, 28, 40 px mark height; default 'md'
  tone?: LogoTone;         // default 'neutral' (fg); 'accent' in the header
}
```

`LogoVariant` stays component-local: it names which artwork is drawn, which no shared union does. Mark heights are brand measures (no sizing token covers them). The glyph is the asset [`assets/brand/mark.svg`](../assets/brand/mark.svg) drawn with `currentColor`; the wordmark is live text in the theme's face, so it follows Sand and Nocturne. Today's `BrandLogo` hard-codes a red polygon and an outlined path with `compact`; the target replaces both. The responsive switch to the mark alone on a narrow screen is the header pattern's choice, using `variant`.

```tsx
<Logo variant="lockup" tone="accent" />
```

## Variants and sizes

| Variant | When to use |
|---|---|
| `lockup` | Header, auth pages. |
| `mark` | Compact header under 400 px, favicons, the app icon, loading screens. |
| `wordmark` | Footers and text-led spots. |

| Tone | Role | When to use |
|---|---|---|
| `neutral` | `fg` | Everywhere except the header. |
| `accent` | `accent` | The header only. Never `live` (red means live). |

Sizes by mark height: `sm` 20, `md` 28, `lg` 40 px. Clear space around the lockup is half the mark's height.

## States

| State | What changes |
|---|---|
| Rest | The tone's role. |
| Hover and focus | None on the logo; when it is a link home, the link takes `focus-ring`. |
| Loading | May pulse its opacity with `motion.duration.slow`; never a rotating logo. |
| Reduced motion | Static. |
| Pressed, disabled, invalid | Not applicable. |

## Tokens

Roles `fg`, `accent`. Radius: none. Type: the UI face at weight 800 with `-0.045em` tracking (not a scale style). Motion `slow` for the loading pulse only.

## Accessibility

- Alone, it is an image with the name "Taitube" (`role="img"` and `aria-label`, or the link's name when it is a home link).
- Inside a link, the link is named "Taitube home" from the catalogue and the logo is `aria-hidden`.
- Contrast: `accent` on `bg` in the header meets 3:1 for graphics in every mode.
- A decorative repeat next to the name is `aria-hidden`.

## Do and don't

- Do use `accent` in the header and `fg` elsewhere.
- Do keep the mark and wordmark proportions; use `variant`, not custom sizes.
- Do respect the clear space.
- Don't recolour it, outline it, or put it in a box.
- Don't use red or the live colour.
- Don't set the wordmark in another face or weight.

## In the workbench

Stories: each variant and size, each tone, on `bg`, on `surface` and on `media`, as a home link with focus, in Sand and Nocturne wordmark faces, the narrow-header swap to `mark`. Axes: themes by modes, RTL (lockup order), reduced motion, more contrast.
