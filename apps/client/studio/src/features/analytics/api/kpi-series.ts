import { assertNever } from '@vp/result';

import type { KpiMetric } from '../types';
import type { RangeAnalytics } from './analytics-queries';

export interface KpiSeries {
  total: number;
  daily: number[];
}

type Day = RangeAnalytics['timeline'][number];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const perView = (watchSeconds: number, views: number) => (views === 0 ? 0 : watchSeconds / views);

export function kpiSeries(metric: KpiMetric, timeline: readonly Day[]): KpiSeries {
  const views = timeline.map((day) => day.views);
  const watchSeconds = timeline.map((day) => day.watchSeconds);

  switch (metric) {
    case 'views':
      return { total: sum(views), daily: views };
    case 'watch-time':
      return { total: sum(watchSeconds), daily: watchSeconds };
    case 'average-view-duration':
      return {
        total: perView(sum(watchSeconds), sum(views)),
        daily: timeline.map((day) => perView(day.watchSeconds, day.views)),
      };
    default:
      return assertNever(metric, 'kpi metric');
  }
}
