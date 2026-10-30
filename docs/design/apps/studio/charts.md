# Charts

`ChartFrame` and the palette helpers every studio chart follows, so charts read as one system in all themes and modes. They live in the studio's kit, `apps/client/studio/src/components/analytics/chart-frame/` ([README](README.md)). The charting library stays in the app; this kit supplies colours, a theme object and a frame, never a chart.

## Anatomy

```
 1 Views per day                                  2 legend: ● Views  ● Watch time
 ┌────────────────────────────────────────────────────────────────┐
 │ 3 gridlines (border)                                            │
 │        ╱╲    4 series (dataviz.categorical, line)               │
 │  ╱╲  ╱  ╲╱╲                                                     │
 │ ╱  ╲╱       ╲                                                   │
 └────────────────────────────────────────────────────────────────┘
   5 x axis (caption, fg-muted)                      6 tooltip (raised)
```

| # | Region | Notes |
|---|---|---|
| 1 | Title | `title`, above the frame |
| 2 | Legend | dot at `IconSize` `sm` plus label in `body-sm`; clickable to isolate a series |
| 3 | Gridlines | `border` role at the divider width, horizontal only |
| 4 | Series | colours from the active theme's `dataviz.categorical-dark` or `-light`; lines at the control border width plus a step, bars with radius `xs` |
| 5 | Axes | `caption`, `fg-muted`, `tabular-nums`; no axis line |
| 6 | Tooltip | `raised`, radius `sm`, elevation 2, `body-sm` |

## Props

Plus the standard props. The helpers are functions and one compound frame.

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type ChartFrameSize = Extract<SizeOption, 'sm' | 'md' | 'lg' | 'xl'>;
export type ChartFrameState = 'ready' | 'loading' | 'error' | 'empty';
export type ChartPalette = 'categorical' | 'sequential' | 'diverging';
export type ChartSeries = 0 | 1 | 2 | 3 | 4 | 5;
```

```ts
interface ChartFrameRootProps {
  size?: ChartFrameSize;   // default 'md'; reserves the plot height (200, 240, 280, 320 px), a constant of this component
  state?: ChartFrameState; // default 'ready'
}
interface ChartFrameLegendItemProps {
  series: ChartSeries;
}
// Parts: ChartFrame.Root, .Title, .Legend, .LegendItem, .Plot

function useChartTheme(): {
  categorical: string[];
  sequential: string[];
  diverging: string[];
  grid: string;
  axis: string;
  tooltipSurface: string;
};
function seriesColor(index: ChartSeries): string;
function sequentialScale(value: number, min: number, max: number): string;
```

```tsx
<ChartFrame.Root size="md">
  <ChartFrame.Title>Views per day</ChartFrame.Title>
  <ChartFrame.Legend><ChartFrame.LegendItem series={0}>Views</ChartFrame.LegendItem></ChartFrame.Legend>
  <ChartFrame.Plot>{chart}</ChartFrame.Plot>
</ChartFrame.Root>
```

`useChartTheme` returns CSS variable references the library can paint with (never resolved hex values in source), and swaps the dark and light categorical palettes with the mode. The kit never imports a charting library. The frame's plot height is from `size` rather than a free number, so the skeleton, the empty line and the error block reserve the same space; the responsive rule below changes `size` by breakpoint, not the numbers.

## Smart wrappers

| Wrapper | Folder | Props | Hooks |
|---|---|---|---|
| `ViewsChart` | `features/analytics/components/` | `range: AnalyticsRange` | `useChannelAnalytics(range)`, `useChartTheme`, `useFormat` (axis and tooltip text), `useT` (title, legend names, the text alternative) |
| `RetentionHeatmap` | `features/analytics/components/` | `videoId: string` | `useVideoAnalytics(videoId)`, `useChartTheme`, `sequentialScale`, `useFormat`, `useT` |

Each wrapper fixes the chart type, the series-to-colour mapping and the frame `size` per breakpoint, renders `ChartFrame.Root` with the charting library's chart inside `ChartFrame.Plot`, maps its query's pending, error and empty results to `state`, and writes the text alternative. The page renders `<ViewsChart range={range} />`.

## Extension points

| Need | Point |
|---|---|
| A one-off tweak | `className` on any part |
| A different chart library | any child of `ChartFrame.Plot`; the kit does not know it |
| A custom legend or an annotation | any element inside `Root`, or a part reading `useChartFrame()` (size, state, isolated series) |
| An extra palette | a new `dataviz` set in the theme, read through `useChartTheme`; not a component change |
| An app-local look | `tv({ extend: chartFrameStyles, variants: { ... } })` |

## Variants

| Palette | Use |
|---|---|
| `categorical` | up to six unrelated series, in order; the sixth is the last, beyond that group into "Other" in `fg-muted` |
| `sequential` | one measure by intensity (a retention heatmap): five steps from the theme's accent ramp |
| `diverging` | a measure around a midpoint (change versus previous): five steps, the midpoint neutral |

Chart types the rules cover: line, area, bar, stacked bar, donut, heatmap, sparkline. Pie charts are not used.

## States

| `state` and interaction | What changes |
|---|---|
| `ready` | as drawn |
| `loading` | `ChartSkeleton` at the reserved height |
| `empty` | frame stays, a centred [EmptyState](../../components/empty-state.md) `inline` size line ("No views yet") |
| `error` | frame stays, a `block` [SectionError](../../components/section-error.md) |
| hover | the nearest point gets a dot at `IconSize` `sm` and a vertical rule in `border-strong`, the tooltip appears |
| series isolated | other series fall to 25 % opacity |
| partial period | the incomplete last bucket is drawn dashed |

## Skeleton

`ChartSkeleton`: the plot area at the frame's `size` height (the same constant `ChartFrame` reserves), the title bar 160 by 22 px, five faint gridlines in `border`, no bars. It takes `size`, so every breakpoint's frame has a skeleton of the same height.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | `size="sm"`, legend wraps below, y axis labels every second gridline, tooltip is tap-to-pin |
| medium | `size="md"` |
| expanded | `size="lg"`, charts in two columns |
| large | `size="xl"`, up to three columns |

## Motion

- Lines draw at `slow` with `settle` on first render, bars grow from the baseline at `slow`.
- Hover dot and tooltip move at `instant`.
- Data updates tween at `base`.
- Reduced motion: charts render in their final state, tooltips appear without movement.

## Accessibility

- Colour is never the only channel: series also differ by dash pattern or marker shape when more than two are shown, and the legend names them.
- Every chart has a text alternative: a visually hidden `table` with the data or a summary sentence in `aria-describedby` ("Views rose 8 percent over 28 days, peaking at 62,400 on 14 October"), written by the wrapper.
- Palettes are checked at 3:1 against `surface` in every theme and mode, by the same gate as the roles.
- The legend items are toggle buttons with `aria-pressed`; tooltips are reachable by keyboard through arrow keys moving the active point.
- Charts use `dataviz.*` and never the UI roles (no `accent` for a series), because the accent means the viewer's own action.

## Composition

`useChartTheme`, `seriesColor`, `sequentialScale`, `ChartFrame`, `Skeleton`, `Badge`, [EmptyState](../../components/empty-state.md) and [SectionError](../../components/section-error.md) for the states. Rendering is the app's chosen library.

## Used by

- [60, creator studio](../../../tickets/60-creator-studio-dashboard-video-management-ui.md): analytics charts, through `ViewsChart` and `RetentionHeatmap`
- [stat card](stat-card.md): the sparkline

## Workbench stories

- Line chart, one and four series
- Stacked bar
- Donut with "Other"
- Heatmap on the sequential scale
- Diverging bar around zero
- All six categorical colours in Sand and Nocturne, dark and light
- Loading, empty, error
- Hover with tooltip
- Isolated series
- RTL axis order
