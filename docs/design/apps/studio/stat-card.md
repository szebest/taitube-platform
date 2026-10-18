# StatCard

One KPI: a label, a big number, a delta and an optional sparkline. It is a shell: the number and delta arrive formatted. It lives in the studio's kit, `apps/client/studio/src/components/analytics/stat-card/` ([README](README.md)); web does not render a KPI today.

## Anatomy

```
┌──────────────────────────────┐
│ 1 Views, last 28 days         │
│ 2 1.24M                       │
│ 3 [+8.4%] vs previous 28 days │
│ 4 ▁▂▃▃▅▆▅▇  sparkline         │
└──────────────────────────────┘
```

| # | Region | Notes |
|---|---|---|
| 1 | Label | `body-sm`, `fg-muted` |
| 2 | Value | `title-lg` at weight 750 (`headline` at `size="lg"`), `tabular-nums`, `fg` |
| 3 | Delta | `Badge` `soft` fill with an arrow icon; tone `success` up, `danger` down, `neutral` flat, always with the arrow and the sign in text |
| 4 | Sparkline | a single `dataviz` categorical series colour, no axes |

## Props

Plus the standard props.

```ts
// types.ts
import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type StatCardSize = Extract<SizeOption, 'md' | 'lg'>;
export type StatCardState = 'ready' | 'loading' | 'error' | 'empty';
export type StatCardTrend = 'up' | 'down' | 'flat';
export type StatCardDeltaTone = Extract<ToneOption, 'success' | 'danger' | 'neutral'>;
export type StatCardSeries = 0 | 1 | 2 | 3 | 4 | 5;
```

```ts
interface StatCardRootProps {
  size?: StatCardSize;     // default 'md'; 'lg' is the dashboard's lead number
  state?: StatCardState;   // default 'ready'
}
interface StatCardDeltaProps {
  trend: StatCardTrend;    // picks the arrow icon and the StatCardDeltaTone
}
interface StatCardSparkProps {
  values: number[];
  series?: StatCardSeries; // index into the active theme's categorical palette
}
// Parts: StatCard.Root, .Label, .Value, .Delta, .Spark
```

```tsx
<StatCard.Root>
  <StatCard.Label>Views, last 28 days</StatCard.Label>
  <StatCard.Value>1.24M</StatCard.Value>
  <StatCard.Delta trend="up">+8.4% vs previous 28 days</StatCard.Delta>
  <StatCard.Spark values={[12, 14, 15, 15, 19, 22, 20, 27]} series={0} />
</StatCard.Root>
```

`Spark` takes raw numbers for drawing and nothing else; its accessible description is the `Delta` text. `series` picks the colour from the active theme's categorical palette (see [Charts](charts.md)). Density is the token sets: at the studio's `compact` spacing and `small` sizing the card tightens and the sparkline is dropped by the compact breakpoint rule, with no prop.

## Smart wrappers

| Wrapper | Folder | Props | Hooks |
|---|---|---|---|
| `KpiCard` | `features/analytics/components/` | `metric: KpiMetric`, `range: AnalyticsRange` | `useChannelAnalytics(range)` (the `getChannelAnalytics` query), `useFormat` (`compact`, `duration`, `percent` for value and delta), `useT` (label, "vs previous" text) |

`KpiMetric` and `AnalyticsRange` are the analytics feature's own unions (`features/analytics/types.ts`). `KpiCard` fixes the label, the formatter and the series index per metric, derives `trend` from the sign of the change, maps loading and error to `state`, and links to the metric's analytics tab through `asChild`. The dashboard renders `<KpiCard metric="views" range={range} />` four times and passes nothing else.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| A clickable card | `asChild` on `StatCard.Root` with a router `Link` |
| An extra region (a goal bar) | any element inside `Root`, or a part reading `useStatCard()` (size, state) |
| An app-local look | `tv({ extend: statCardStyles, variants: { ... } })` |

## Variants

| `size` | Difference |
|---|---|
| `md` | card, `inset-card` padding, radius `card`, `surface` |
| `lg` | value in `headline` type and a taller sparkline, the dashboard's lead number |

## States

| `state` and flags | What changes |
|---|---|
| `ready` | as drawn |
| `loading` | `StatCardSkeleton` |
| `empty` | value shows a "No data yet" placeholder in `fg-muted`, no delta, no sparkline |
| `error` | label stays, value replaced by a `bar` [SectionError](../../components/section-error.md) |
| flat | `trend="flat"`: `neutral` tone with a dash icon |
| clickable | the root is a link (`asChild`) with hover elevation 1 and a chevron |

## Skeleton

`StatCardSkeleton` for each `size`: the card at the loaded height (label bar 96 by 16 px, value bar 120 by the value's line box, delta bar 64 by 20 px, sparkline block 100 % by the sparkline height), radius `card`, `inset-card` padding. The skeleton and the card read one height constant per `size`, so a refetch never shifts the grid.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | two cards per row, value `title-lg`, sparkline hidden |
| medium | three per row |
| expanded | four per row |
| large | four to six per row, sparkline shown |

## Motion

- The value counts up from the previous value over `slow` with `settle` on first load only, never on refetch.
- Delta badge fades in at `base`.
- Sparkline draws left to right at `slow`.
- Reduced motion: values and lines render in their final state.

## Accessibility

- The card is a `figure` with the label as `figcaption`; or a link when clickable. The value and delta are read in order ("Views, last 28 days, 1.24M, up 8.4 percent versus previous 28 days").
- The sparkline is `aria-hidden`: its meaning is in the delta text.
- The trend is conveyed by arrow icon plus text, not colour alone.
- Contrast of `success-ink` and `danger-ink` is checked against `surface`.

## Composition

`Card`, `Badge`, `Icon`, `Skeleton`. The sparkline uses the [Charts](charts.md) helpers.

## Used by

- [60, creator studio](../../../tickets/60-creator-studio-dashboard-video-management-ui.md): dashboard KPIs, through `KpiCard`

## Workbench stories

- Default, delta up
- Delta down and flat
- Large
- Loading, empty, error
- Clickable
- Large numbers (12.4M) and narrow widths
- All six categorical series colours on the sparkline
- RTL
