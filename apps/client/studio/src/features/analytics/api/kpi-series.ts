import { assertNever } from '@vp/result';
import type { KpiMetric } from '../types';
import type { RangeAnalytics } from './analytics-queries';

export interface KpiSeries {
  total: number;
  daily: number[];
  /** The same figure over the period just before the range; `null` when there is none (lifetime). */
  previous: number | null;
}

const perView = (watchSeconds: number, views: number) => (views === 0 ? 0 : watchSeconds / views);

export function kpiSeries(
  metric: KpiMetric,
  { timeline, rangeViews, rangeWatchSeconds, previous }: RangeAnalytics
): KpiSeries {
  switch (metric) {
    case 'views':
      return {
        total: rangeViews,
        daily: timeline.map((day) => day.views),
        previous: previous?.rangeViews ?? null,
      };
    case 'watch-time':
      return {
        total: rangeWatchSeconds,
        daily: timeline.map((day) => day.watchSeconds),
        previous: previous?.rangeWatchSeconds ?? null,
      };
    case 'average-view-duration':
      return {
        total: perView(rangeWatchSeconds, rangeViews),
        daily: timeline.map((day) => perView(day.watchSeconds, day.views)),
        previous:
          previous === null ? null : perView(previous.rangeWatchSeconds, previous.rangeViews),
      };
    default:
      return assertNever(metric, 'kpi metric');
  }
}
