# ChipBar

Location: `apps/client/web/src/components/discovery/chip-bar/`. Web's app kit, presentational and compound, built from the `Chip` and `IconButton` primitives.

The row of category or filter chips above a feed, one selected. The selection is the one place the accent says "your position" on a browse page.

## Anatomy

```
 [<] ┌───────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────┐ ┌────────▒▒ [>]
     │ 1 All     │ │ Film    │ │ Music  │ │ Cooking │ │ Live │ │ Travel ▒▒
     └───────────┘ └─────────┘ └────────┘ └─────────┘ └──────┘ └────────▒▒
```

| # | Part | Notes |
|---|---|---|
| 1 | `Item` | `control.sm` high, radius `chip`, `tint` ground, `label` |
| 2 | selected `Item` | `accent` ground, `on-accent` text |
| 3 | edge chevrons | pointer devices when the row overflows |
| 4 | fade mask | 40 px at each overflowing edge |

## Props

```ts
// types.ts
export type ChipBarValue = string | string[];
```

```ts
interface ChipBarRootProps {
  value: ChipBarValue;
  onValueChange: (value: ChipBarValue) => void;
}

interface ChipBarItemProps {
  value: string;
  count?: string;
  disabled?: boolean;
}
```

An array `value` makes the bar multi-select (checkbox semantics), a string single-select (radio semantics), so there is no `mode` prop. `count` is a finished string shown in `caption`. The group's name is the caller's `aria-label`. Overflow chevrons and sticky behaviour are the kit's.

## Variants

| Case | Difference |
|---|---|
| single | one selected; Home categories |
| multiple | any number selected; filters |
| with count | a `caption` count after the label; search type chips |

## States

| State | What changes |
|---|---|
| hover | `tint-strong`, `fast` |
| selected | `accent` ground, `aria-checked` or `aria-current` |
| focus | `focus-ring` with offset |
| disabled | `fg-subtle`, out of the tab order unless selected |
| overflow | chevrons and masks on the side with hidden chips |
| sticky | pinned under the header on `bg` with a `border.divider` once content scrolls under |

## Responsive behaviour

Compact: scrolls, no chevrons, `gutter-compact` start gutter, chips `control.md` high (44 px target by padding). Medium: chevrons on pointer. Expanded and large: usually all fit; the mask only when they do not. The selected chip scrolls into view on mount and on change.

## Skeleton

`ChipBarSkeleton`: seven pills `control.sm` high, widths 56, 72, 64, 88, 72, 56, 96 px, 10 px gap. Rules in [skeletons](../../components/skeletons.md).

## Motion

Ground change `fast`. Scroll into view `base` with `settle`. Chevron press scrolls 60 % at `slow`. Reduced motion: instant.

## Accessibility

- `role="radiogroup"` (single) or `role="group"` (multiple); chips are radios or `aria-pressed` buttons; as links the selected one has `aria-current="true"`.
- Roving tabindex: arrows move and select in single mode, move focus only in multiple (Space toggles); Home and End jump.
- The change is announced by the feed's heading, not the bar. Disabled chips keep `aria-disabled`.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Item`: the wrapper passes a router `Link` carrying the search param.
- `useChipBar()` returns `{ value, isSelected, select }` for an app-local item.
- `tv({ extend: chipBarStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `CategoryChipBar` | `browse/components/` | none | `useCategories`, the route's `category` search param (`Route.useSearch`, `useNavigate`), `useT` |
| `SearchTypeChipBar` | `search/components/` | `counts: Partial<Record<SearchType, number>>` | the route's `type` search param, `useFormat`, `useT` |

Both fix single selection and render each item as a router `Link`, so the selection is the URL.

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) Home and Explore categories; [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) result type and zero-result topics.

## Workbench stories

Home categories; overflow with masks and chevrons; multiple selection; with counts; disabled chip; sticky; links; compact touch size; RTL.
