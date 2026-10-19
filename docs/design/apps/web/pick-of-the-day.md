# PickOfTheDay

Location: `apps/client/web/src/components/discovery/pick-of-the-day/`. Web's app kit, presentational and compound, built from [VideoCard](video-card.md) (`spotlight`), `Button` and `IconButton`.

The hero of Home: one video chosen for the day, with a short note in the editorial serif and a visible window. It is the "Pick of the day" signature move, and the first sign that a person chose this.

## Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  glow sampled from the thumbnail, blurred, behind the card            │
│ ┌───────────────────────────────┐   1 PICK OF THE DAY                 │
│ │      3 thumbnail  [4K]        │   2 Shot entirely on a 1998        │
│ │                        18:42  │     camcorder: Lisbon at night      │
│ └───────────────────────────────┘   4 "Eighteen minutes of trams and  │
│                                       wet tiles." (serif)             │
│                                     5 Picked today, 14 h left         │
│   ● MARTA REIS FILMS · 412K views   [ 6 Watch ] [ 7 Queue ] [ 8 Save ]│
└──────────────────────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Kicker` | `overline`, `accent-ink` |
| 2 | title | the card's `Title`: `headline` on expanded and up, `title-lg` below |
| 3 | thumbnail | the card's `Thumb`, radius `thumb`, up to 640 px, muted preview on hover (pointer) |
| 4 | `Note` | `editorial` (Newsreader), three lines at most; the only serif on the page |
| 5 | `Window` | `caption`, `fg-muted`, finished by the wrapper |
| 6 to 8 | `Actions` | primary `Button`, outline `Button`, `IconButton` |

## Props

```ts
// types.ts
export type PickOfTheDayLayout = 'default' | 'stacked';
```

```ts
interface PickOfTheDayRootProps {
  layout?: PickOfTheDayLayout;
  glowColor?: string;
}
```

The card inside is a `VideoCard.Root variant="spotlight"` passed as children, so the pick's data is never re-declared here. `layout` follows the breakpoint when omitted. `glowColor` is a CSS colour the wrapper sampled; it is painted only as a blurred glow (`ambient.blur`), and `data-ambient="off"` hides it. A pick without a note or window (the fallback until the curation follow-up lands, see [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md)) omits those parts and keeps the spotlight layout.

## Variants

| Layout | Difference |
|---|---|
| `default` | thumbnail start, copy end |
| `stacked` | thumbnail above the copy, below the expanded breakpoint |

## States

| State | What changes |
|---|---|
| hover | thumbnail lifts 2 px, muted preview after 500 ms on pointer |
| focus | `focus-ring` on Watch and the thumbnail link |
| no pick | nothing renders; Home continues with Continue watching |
| unavailable video | the wrapper does not pass it |

The window label is the only signal as it nears its end; it is plain text, not a ticking timer.

## Responsive behaviour

Compact: `stacked`, buttons full width in a row, note two lines. Medium: `stacked`, thumbnail to 480 px. Expanded: `default`, thumbnail 420 to 640 px. Large: `default`, title `display`, note three lines.

## Skeleton

`PickOfTheDaySkeleton`: card 100 % by 304 px, padding 24 px, radius `card`; thumbnail 16:9 at 460 px; copy column: kicker bar 88 by 13, title bars 100 % and 64 % by 37, note bars 100 % by 28 and 80 %, window bar 160 by 16, buttons 96 by `control.md` and 88 by `control.md`. Stacked at compact: thumbnail full width. Rules in [skeletons](../../components/skeletons.md).

## Motion

Entry: card fades in at `base` with `enter`, glow at `slow`. Hover lift `slow` with `settle`, preview crossfade `base`. Watch: the thumbnail is a shared element into the [Stage](stage.md) at `cinematic`. Reduced motion: no lift, preview or shared element; the glow stays static.

## Accessibility

- A `section` labelled by the kicker; the title is the primary link. The note is a plain paragraph, not a quote.
- The glow is `aria-hidden`; contrast is computed against `surface`, never the glow.
- The preview is muted and paused under reduced motion and off screen.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Kicker` and `Note` (a heading element); the inner card follows [VideoCard](video-card.md).
- `usePickOfTheDay()` returns `{ layout, glowColor }` for an app-local part.
- `tv({ extend: pickOfTheDayStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `HomePickOfTheDay` | `browse/components/` | none | `usePickOfTheDay`, `useAmbientSample(posterUrl)`, `useFormat`, `useT`, `useVideoActions` |

It fixes the card to `spotlight`, links Watch to the watch route, and renders nothing when there is no pick.

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md): Home, item 2 of the guide's list.

## Workbench stories

Note and window; plain fallback; long title and note; bright and dark glow; hover with preview; stacked at compact; window under an hour; RTL; skeleton.
