import type { ChartSeries } from './types';

export const CHART_SERIES = [0, 1, 2, 3, 4, 5] as const satisfies readonly ChartSeries[];

/** The active theme's categorical colour for `index`; the theme's CSS swaps it with the mode. */
export function seriesColor(index: ChartSeries): string {
  return `var(--dataviz-categorical-${index + 1})`;
}
