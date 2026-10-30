import { Format, useT } from '@vp/intl-react';
import { Skeleton } from '@vp/ui';
import { lazy, Suspense } from 'react';

import { ChartFrame } from '#app/components/analytics/chart-frame';
import { dayInstant } from '../day-instant';
import { useAnalytics } from '../hooks/use-analytics';
import type { AnalyticsRange, AnalyticsScope } from '../types';

const ViewsPlot = lazy(() =>
  import('./views-plot').then(({ ViewsPlot }) => ({ default: ViewsPlot }))
);

export interface ViewsChartProps {
  scope: AnalyticsScope;
  range: AnalyticsRange;
}

export function ViewsChart({ scope, range }: ViewsChartProps) {
  const { tOr } = useT();
  const { data, isPending, isError, refetch } = useAnalytics(scope, range);
  const title = tOr('studio.viewsChartTitle', {}, '');
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

  return (
    <ChartFrame.Root state={data.rangeViews === 0 ? 'empty' : 'ready'}>
      <ChartFrame.Title>{title}</ChartFrame.Title>
      <ChartFrame.Legend>
        <ChartFrame.LegendItem series={0}>{series}</ChartFrame.LegendItem>
      </ChartFrame.Legend>
      <ChartFrame.Plot>
        <Suspense fallback={<Skeleton className="tw:h-full tw:w-full" />}>
          <ViewsPlot timeline={data.timeline} name={series} />
        </Suspense>
      </ChartFrame.Plot>
      <ChartFrame.Description>
        <table>
          <thead>
            <tr>
              <th scope="col">{tOr('studio.chartColumnDay', {}, '')}</th>
              <th scope="col">{tOr('studio.chartColumnViews', {}, '')}</th>
            </tr>
          </thead>
          <tbody>
            {data.timeline.map(({ viewDate, views }) => (
              <tr key={viewDate}>
                <th scope="row">
                  <Format value={{ type: 'date', value: dayInstant(viewDate) }} />
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
