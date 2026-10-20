# Icon

A sized, stroke-consistent wrapper for a Lucide glyph; every icon in the product goes through it.

## Anatomy

```
   +----+
   | (1)|   `sizing.icon` sm, md or lg square, stroke 1.75, round caps and joins
   +----+
```

| # | Part | Notes |
|---|---|---|
| 1 | Glyph | One Lucide component passed as the child; inherits colour from `currentColor`. |

## API

```ts
// types.ts
import type { IconSize, ToneOption } from '@vp/design-tokens';

export type IconTone = 'inherit' | Extract<ToneOption, 'neutral' | 'accent' | 'danger'>;
```

```ts
interface IconProps extends ComponentPropsWithRef<'svg'> {
  name: IconId;            // an inventory id (iconography.md), never a Lucide import
  size?: IconSize;         // sizing.icon; default 'md'
  tone?: IconTone;         // default 'inherit'
}
```

Usage is `<Icon name="search" size="sm" />`: the id picks the glyph from `src/icons/inventory.tsx`, so the
inventory is the one place a glyph is chosen and the directional ids mirror under RTL (`MIRROR_IN_RTL`). The
wrapper sets size, stroke and `aria-hidden`. It is decorative unless it has an `aria-label`. `tone` only picks a role; most icons inherit from their parent, and `neutral` is the muted metadata colour. `IconTone` widens the shared tone union with `'inherit'` (`currentColor`), which no tone names. There is no filled variant: an active item is shown by its ground, never by swapping the glyph.

```tsx
<Icon name="clock" size="lg" tone="neutral" />
```

## Variants and sizes

| Tone | Role | When to use |
|---|---|---|
| `inherit` | `currentColor` | Almost always. |
| `neutral` | `fg-muted` | Metadata icons. |
| `accent` | `accent-ink` | The active nav item's icon. |
| `danger` | `danger-ink` | A destructive item. |

| Size | Box | Where |
|---|---|---|
| `sm` | `sizing.icon.sm` | Inside small buttons, badges, menu items, inputs |
| `md` | `sizing.icon.md` | Default: buttons, toolbars |
| `lg` | `sizing.icon.lg` | Large buttons, rail items, empty states |

## States

| State | What changes |
|---|---|
| Rest | Colour from the tone. |
| Hover, focus, pressed, disabled | Inherited from the control that holds it (`fg-subtle` when disabled). |
| Loading | Never replaced by an Icon; use [spinner](spinner.md). |
| Mirrored | Directional glyphs (arrows, chevrons) flip under RTL through a `rtl:` rule on the wrapper; non-directional glyphs do not. |

## Tokens

- Colour roles `fg-muted`, `accent-ink`, `danger-ink`, `fg-subtle`, and `currentColor`.
- `sizing`: `icon` sm, md, lg. Stroke 1.75. Radius, type and motion: none.

## Accessibility

- Decorative by default: `aria-hidden="true"`, no focus.
- A meaningful icon (not next to text) takes `role="img"` and an `aria-label`; prefer a visible label.
- Icon-only controls are named by the control ([icon-button](icon-button.md)), not by the icon.
- Never convey status by colour of an icon alone; pair with text.

## Do and don't

- Do use only the three `IconSize` steps.
- Do use Lucide only; one set, one stroke.
- Do let the icon inherit colour.
- Don't import glyphs from elsewhere or from another stroke weight.
- Don't scale an icon with a transform; change `size`.
- Don't use a different glyph to show an active state.

## In the workbench

Stories: every size (3), every tone (4), a directional glyph in RTL, inside a button, a menu item and an input, with `aria-label`, the full set used by the product as a grid. Axes: themes by modes, RTL, more contrast.
