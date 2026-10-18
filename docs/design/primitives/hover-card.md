# HoverCard

A read-only preview that appears when a pointer rests on a link, so a viewer can peek before committing to a click.

## Anatomy

```
   (1) @marta-reis   <- link trigger
      +--------------------------+
      | (2) avatar  Marta Reis   |
      |     284K followers       |
      | (3) one-line bio         |
      | (4) [Follow]             |
      +--------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `HoverCard.Trigger` | A real link; `asChild`. The click still navigates. |
| 2 | `HoverCard.Content` | `raised` panel, radius `card`, elevation-2. |
| 3 | Body | Presentational content only. |
| 4 | Actions | Optional; the card is a preview, so every action must also exist on the target page. |

## API

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';
import type { Align, Side } from '../../types';

export type HoverCardSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface HoverCardContentProps extends Omit<ComponentPropsWithRef<typeof HoverCard.Content>, 'side' | 'align'> { // Radix HoverCard
  size?: HoverCardSize;   // 280 or 360 px width; default 'md'
  side?: Side;            // default 'block-end'
  align?: Align;          // default 'center'
}
// Parts: HoverCard.Root (openDelay 500, closeDelay 150), .Trigger, .Content, .Arrow
```

New in 95. The 500 ms `openDelay` matches the guide's expand-on-hover timing. It never opens on touch (Radix ignores touch), so nothing here may be the only way to reach content. Widths are component measures (no sizing token covers a panel width).

```tsx
<HoverCard.Root>
  <HoverCard.Trigger asChild><a href={channel.href}>@{channel.handle}</a></HoverCard.Trigger>
  <HoverCard.Content size="sm">...</HoverCard.Content>
</HoverCard.Root>
```

## Variants and sizes

| Size | Width | When to use |
|---|---|---|
| `sm` | 280 px | A channel or user preview. |
| `md` | 360 px | A playlist or video preview with a sprite. |

One visual variant: `raised`, `border`, `fg`, `fg-muted`, elevation 2. Padding `spacing.inset-card`.

## States

| State | What changes |
|---|---|
| Closed | Trigger as a normal link. |
| Opening | After `openDelay`; fade and a short move, `motion.duration.base` with `enter`. |
| Open | The pointer may move into the card without closing it. |
| Closing | After `closeDelay`; `fast` with `exit`. |
| Focus-visible | Keyboard focus on the trigger opens it too (Radix opens on focus); Escape closes. |
| Reduced motion | Opacity only. |
| Disabled, loading | Loading content renders a [skeleton](skeleton.md) at the card's final size to avoid a layout jump. |

## Tokens

- Colour roles `raised`, `border`, `fg`, `fg-muted`.
- `spacing`: `inset-card`, `gap-inline`. `radius`: `card`. `border`: `divider`. `shadow`: elevation 2.
- Type `title`, `body-sm`. `motion`: `base`, `fast`, easings `enter`, `exit`. z `popover`.

## Accessibility

- Radix HoverCard is a pointer and focus enhancement: the card is not announced as a dialog and is skipped by screen readers' main flow. Content must therefore be duplicated on the destination.
- The trigger remains a normal link and is the keyboard path.
- Never place the only copy of an action or fact in the card.
- Touch devices never see it; do not rely on it for onboarding.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Trigger` and `Content`.
- `useHoverCard()` returns `{ size, open }`, so a part written in an app can read it.
- `hoverCardStyles`, the `tv()` definition, is exported: `tv({ extend: hoverCardStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do use it on links to a channel, a user or a playlist.
- Do keep content presentational and short.
- Do reuse the same data the destination page loads.
- Don't put essential actions in it.
- Don't use it on a trigger the user clicks to open something; use a [popover](popover.md).
- Don't open it instantly; the delay avoids flicker when the pointer crosses a list.

## In the workbench

Stories: channel preview, playlist preview, loading skeleton, each side and align, collision at edges, with and without action. States: opening, open, closing, keyboard-focus open. Axes: themes by modes, RTL, reduced motion, a touch emulation showing it stays closed.
