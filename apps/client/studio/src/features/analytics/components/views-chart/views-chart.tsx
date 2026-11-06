import { HOURLY_WINDOW_HOURS } from '@vp/domain';
import type { FormatValue } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { Skeleton } from '@vp/ui';
import { Suspense } from 'react';
import { ChartFrame } from '#app/components/analytics/chart-frame';
import type { RangeAnalytics } from '#app/features/analytics/api/analytics-queries';
import { useAnalytics } from '#app/features/analytics/hooks/use-analytics';
import type {
  AnalyticsRange,
  AnalyticsScope,
  ViewsGranularity,
} from '#app/features/analytics/types';
import { dayInstant } from '#app/features/analytics/utils/day-instant';
import type { ViewsPoint } from '../views-plot/views-plot';
import { LazyViewsPlot } from '../views-plot/views-plot.lazy';

interface GranularityPresentation {
  points: (analytics: RangeAnalytics) => ViewsPoint[];
  tick: (at: string) => FormatValue;
  label: (at: string) => FormatValue;
}

const GRANULARITY = {
  day: {
    points: ({ timeline }) =>
      timeline.map(({ viewDate, views }) => ({ at: dayInstant(viewDate), views })),
    tick: (at) => ({ type: 'date', value: at, options: { month: 'short', day: 'numeric' } }),
    label: (at) => ({ type: 'date', value: at }),
  },
  hour: {
    points: ({ hourly }) => hourly.map(({ viewHour, views }) => ({ at: viewHour, views })),
    tick: (at) => ({ type: 'time', value: at, options: { hour: 'numeric' } }),
    label: (at) => ({
      type: 'dateTime',
      value: at,
      options: { month: 'short', day: 'numeric', hour: 'numeric' },
    }),
  },
} as const satisfies Record<ViewsGranularity, GranularityPresentation>;

export interface ViewsChartProps {
  scope: AnalyticsScope;
  range: AnalyticsRange;
  /** `hour` draws the last 48 hours, whatever the range. */
  granularity: ViewsGranularity;
}

export function ViewsChart({ scope, range, granularity }: ViewsChartProps) {
  const { tOr } = useT();
  const { data, isPending, isError, refetch } = useAnalytics(scope, range);
  const { points, tick, label } = GRANULARITY[granularity];
  const daily = granularity === 'day';
  const title = daily
    ? tOr('studio.viewsChartTitle', {}, '')
    : tOr('studio.hourlyChartTitle', { hours: HOURLY_WINDOW_HOURS }, '');
  const series = tOr('studio.viewsChartSeries', {}, '');

  if (isPending) {
    return <ChartFrame.Root state="loading" />;
  }

  if (isError) {
    return (
      <ChartFrame.Root state="error" onRetry={() => void refetch()}>
        <ChartFrame.Title>{title}</ChartFrame.Title>
        <ChartFrame.Plot />
      </ChartFrame.Root>
    );
  }

  const shown = points(data);

  return (
    <ChartFrame.Root state={shown.every(({ views }) => views === 0) ? 'empty' : 'ready'}>
      <ChartFrame.Title>{title}</ChartFrame.Title>
      <ChartFrame.Legend>
        <ChartFrame.LegendItem series={0}>{series}</ChartFrame.LegendItem>
      </ChartFrame.Legend>
      <ChartFrame.Plot>
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <LazyViewsPlot points={shown} name={series} tick={tick} label={label} />
        </Suspense>
      </ChartFrame.Plot>
      <ChartFrame.Description>
        <table>
          <thead>
            <tr>
              <th scope="col">
                {daily
                  ? tOr('studio.chartColumnDay', {}, '')
                  : tOr('studio.chartColumnHour', {}, '')}
              </th>
              <th scope="col">{tOr('studio.chartColumnViews', {}, '')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ at, views }) => (
              <tr key={at}>
                <th scope="row">
                  <Format value={label(at)} />
                </th>
                <td>
                  <Format value={{ type: 'number', value: views }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartFrame.Description>
    </ChartFrame.Root>
  );
}
