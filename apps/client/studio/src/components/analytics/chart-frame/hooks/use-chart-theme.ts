import { SEQUENTIAL } from './sequential-scale';
import { CHART_SERIES, seriesColor } from './series-color';
import type { ChartPalette } from './types';

const CHART_THEME = {
  categorical: CHART_SERIES.map(seriesColor),
  sequential: SEQUENTIAL,
  diverging: [1, 2, 3, 4, 5].map((step) => `var(--dataviz-diverging-${step})`),
  grid: 'var(--border)',
  axis: 'var(--fg-muted)',
  tooltipSurface: 'var(--raised)',
} as const satisfies Record<ChartPalette, readonly string[]> & {
  grid: string;
  axis: string;
  tooltipSurface: string;
};

export type ChartTheme = typeof CHART_THEME;

/**
 * CSS variable references a charting library paints with. The theme's stylesheet scopes every
 * `--dataviz-*` variable by `data-theme` and `data-mode`, so one set of references follows the
 * dark and light palettes without a re-render.
 */
export function useChartTheme(): ChartTheme {
  return CHART_THEME;
}
