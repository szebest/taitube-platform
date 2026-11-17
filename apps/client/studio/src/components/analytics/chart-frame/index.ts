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
export { sequentialScale } from './utils/sequential-scale';
export type { ChartTheme } from './hooks/use-chart-theme';
export { useChartTheme } from './hooks/use-chart-theme';
