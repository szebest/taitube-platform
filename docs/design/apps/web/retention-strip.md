# RetentionStrip

Location: `apps/client/web/src/components/watch/retention-strip/`, presentational, built from `IconButton` and the `dataviz` categorical palette (`seriesColor`, `@vp/components`).

The retention curve of one video as a row of bars, one per 5 percent step, with a marker over each drop-off. It sits in the creator stats panel on the watch page ([114](../../../tickets/114-creator-stats-on-the-watch-page.md)), beside the buttons that list the same drop-offs.

## Anatomy

```
        (1)   (2)
         o     o          1 Marker, at its place along the video
 ▇▆▅▅▄▄▃▃▃▂▂▂▂▁▁▁▁▁▁   2 Bars, one per step, as tall as the share still watching
```

| # | Part | Notes |
|---|---|---|
| 1 | `Marker` | a small round `IconButton`, `danger` tone, placed by `percent` with `inset-inline-start` |
| 2 | bars | `flex-1` columns on a `gap-px` row, `seriesColor(0)`, rounded tops |

## Props

```ts
interface RetentionStripRootProps {
  values: readonly number[]; // share still watching at each step, 0 to 1
}
interface RetentionStripMarkerProps {
  percent: number;           // 0 to 100
  'aria-label': string;
}
// Parts: RetentionStrip.Root, .Marker
```

The wrapper derives `values` from the curve (viewers over the viewers who began) and passes one `Marker` per drop-off. The kit formats nothing and never seeks: `onClick` is the wrapper's.

## Extension points

`className` on both parts, `style` on `Marker`, `tv({ extend: retentionStripStyles })`.

## States

| State | What changes |
|---|---|
| no data | the wrapper renders no strip and says so in text |
| flat curve | equal bars |

## Responsive behaviour

The strip fills its column; a marker grows to the touch target (24 px) on a coarse pointer.

## Motion

None: the bars and markers are static. Reduced motion changes nothing.

## Accessibility

The bars are decorative (`aria-hidden`). A marker is a pointer shortcut: it is `aria-hidden` and out of the tab order, because the same action is a labelled button in the list beside the strip ("0:42, 18% leave here"), which is what keyboard and screen reader users reach. Under `dir="rtl"` the strip and the markers mirror.

## Composition

`IconButton`, `seriesColor`.

## Used by

- [114, creator stats on the watch page](../../../tickets/114-creator-stats-on-the-watch-page.md): `CreatorStatsPanel`

## Workbench stories

- Default, with markers, flat curve
- RTL
