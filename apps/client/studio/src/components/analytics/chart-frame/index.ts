import {
  ChartFrameDescription,
  ChartFrameLegend,
  ChartFrameLegendItem,
  ChartFramePlot,
  ChartFrameRoot,
  ChartFrameTitle,
} from './chart-frame';

export const ChartFrame = {
  Root: ChartFrameRoot,
  Title: ChartFrameTitle,
  Legend: ChartFrameLegend,
  LegendItem: ChartFrameLegendItem,
  Plot: ChartFramePlot,
  Description: ChartFrameDescription,
};
export { ChartSkeleton } from './chart-frame';
export { useChartFrame } from './chart-frame.context';
export { chartFrameStyles } from './chart-frame.variants';
export { sequentialScale } from './sequential-scale';
export { CHART_SERIES, seriesColor } from './series-color';
export type { ChartSeries } from './types';
export type { ChartTheme } from './use-chart-theme';
export { useChartTheme } from './use-chart-theme';
