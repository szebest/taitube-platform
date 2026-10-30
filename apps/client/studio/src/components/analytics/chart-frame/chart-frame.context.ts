import { createCompoundContext } from '@vp/ui';
import type { ChartFrameSize, ChartFrameState, ChartSeries } from './types';

export type ChartFrameShared = {
  size: ChartFrameSize;
  /** The series the legend isolated; the chart draws the others at 25 % opacity. */
  isolated: ChartSeries | undefined;
  toggleIsolated: (series: ChartSeries) => void;
  descriptionId: string;
} & (
  | { state: Exclude<ChartFrameState, 'error'> }
  | { state: Extract<ChartFrameState, 'error'>; onRetry: () => void }
);

export const [ChartFrameContext, useChartFrame] =
  createCompoundContext<ChartFrameShared>('ChartFrame');
