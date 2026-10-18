# Card

A bordered surface that groups related content; it is a container, not a video card (that is web's `VideoCard`).

## Anatomy

```
  +----------------------------------+
  | (1) Header                       |
  |   (2) Title            (3) action|
  |   (4) Description                |
  |----------------------------------|
  | (5) Content                      |
  |----------------------------------|
  | (6) Footer                       |
  +----------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | `Card.Header` | Column with `gap-inline` at `sm`, `gap-stack` at `md`. |
| 2 | `Card.Title` | `title` style, rendered as the heading level the caller passes (`as`). |
| 3 | `Card.Action` | Optional slot at the end of the header row. |
| 4 | `Card.Description` | `body-sm` in `fg-muted`. |
| 5 | `Card.Body` | The body. |
| 6 | `Card.Footer` | Row with `gap-inline`, actions at the end. |

## API

```ts
// types.ts
import type { ElevationOption, SizeOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type CardFill = Extract<FillOption, 'solid' | 'outline' | 'ghost'>;
export type CardSize = Extract<SizeOption, 'sm' | 'md'>;
export type CardElevation = ElevationOption;
```

```ts
interface CardRootProps extends ComponentPropsWithRef<'div'> {
  variant?: CardFill;         // default 'solid'
  elevation?: CardElevation;  // none by default; 2 for a raised card
  size?: CardSize;            // padding role; default 'md'
}
// Parts: Card.Root, Card.Header, Card.Title, Card.Description, Card.Action, Card.Body, Card.Footer
```

The old `surface` and `raised` variants are `solid` with no elevation and `solid` with `elevation={2}`. The heading level is set with `asChild`: `<Card.Title asChild><h2>...</h2></Card.Title>`. A whole-card link is `<Card.Root asChild><a>`; a card rendered as a link or button lifts on hover, so there is no `interactive` prop. Today's `Card` uses a `surface-elevated` background that is not a role and flat names (`CardHeader`, `CardContent`).

```tsx
<Card.Root variant="solid" size="md">
  <Card.Header>
    <Card.Title asChild><h2>Upload quality</h2></Card.Title>
    <Card.Description>Applies to new uploads.</Card.Description>
  </Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer><Button variant="solid" tone="accent">Save</Button></Card.Footer>
</Card.Root>
```

## Variants and sizes

| Variant | Roles | When to use |
|---|---|---|
| `solid` | `surface`, `border`; with `elevation={2}` `raised` and the shadow set's step 2 | Default panel on the `bg` ground; raised for a card above other cards. |
| `outline` | transparent, `border-strong` | A card on a `surface` ground. |
| `ghost` | transparent, no border | Layout grouping that needs the same padding and parts. |

| Size | Padding | Gap |
|---|---|---|
| `sm` | `spacing.inset-control` | `gap-inline` |
| `md` | `spacing.inset-card` | `gap-stack` |

The spacing set already scales with density, so there is no separate multiplier.

## States

| State | What changes |
|---|---|
| Rest | Variant roles. |
| Hover (interactive) | Lifts 2 px, elevation 2, `motion.duration.slow` with `settle`; `tint` overlay never replaces the lift. |
| Focus-visible | `focus-ring` on the card when it is the link. |
| Pressed | Lift cancels over `motion.duration.instant`. |
| Disabled | Not applicable; disable the control inside. |
| Loading | Compose with [skeleton](skeleton.md) of identical dimensions. |

## Tokens

- Colour roles `surface`, `raised`, `border`, `border-strong`, `fg`, `fg-muted`, `tint`, `focus-ring`.
- `spacing`: `inset-control`, `inset-card`, `gap-inline`, `gap-stack`. `radius`: `card`.
- `border`: `divider` (solid border), `control` (outline), `focus`, `focus-offset`. `shadow`: elevation 1 and 2.
- Type `title`, `body-sm`. `motion`: `slow`, `instant`, easing `settle`.

## Accessibility

- A `div` by default. Use `asChild` with an `article` or `section` when the card is a landmark of content; give it a heading through `Card.Title`.
- An interactive card has one primary link (the title, stretched with a pseudo-element); never wrap interactive children in an interactive card.
- Hover lift does not shift layout: it is a `transform`.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Card.Root` (a link or `article`), `Card.Title` and `Card.Action`.
- `useCard()` returns `{ variant, size }`, so a part written in an app can read it.
- `cardStyles`, the `tv()` definition, is exported: `tv({ extend: cardStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do put a heading in every card that stands alone in the reading order.
- Do use `gap` between parts, never margins.
- Do pick the heading level from the page outline, not the look.
- Don't nest `surface` cards inside `surface` cards; use `outline` or `ghost`.
- Don't use a card to hold a single line of text; use a [callout](callout.md).
- Don't build a video card from this primitive; use web's `VideoCard`.

## In the workbench

Stories: each variant (3), raised (elevation 2), each size (2), interactive hover and focus, with action slot, header only, footer only, long title wrapping to two lines, over `bg` and over `surface`. Axes: themes by modes (card radius is round in Sand, sharp in Nocturne), compact density, RTL, more contrast.
