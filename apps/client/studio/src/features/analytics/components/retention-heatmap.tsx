import { useQuery } from '@tanstack/react-query';
import { Format, useT } from '@vp/intl-react';
import { useApi, videoRetentionQueryOptions } from '@vp/queries';
import { Skeleton } from '@vp/ui';
import { lazy, Suspense } from 'react';

import { ChartFrame } from '#app/components/analytics/chart-frame';

const RetentionPlot = lazy(() =>
  import('./retention-plot').then(({ RetentionPlot }) => ({ default: RetentionPlot }))
);

export interface RetentionHeatmapProps {
  videoId: string;
}

export function RetentionHeatmap({ videoId }: RetentionHeatmapProps) {
  const { tOr } = useT();
  const api = useApi();
  const { data, isPending, isError, refetch } = useQuery(videoRetentionQueryOptions(api, videoId));
  const title = tOr('studio.retentionTitle', {}, '');
  const series = tOr('studio.retentionViewers', {}, '');

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

  const played = data.curve.some(({ viewers }) => viewers > 0);

  return (
    <ChartFrame.Root state={played ? 'ready' : 'empty'}>
      <ChartFrame.Title>{title}</ChartFrame.Title>
      <ChartFrame.Plot>
        <Suspense fallback={<Skeleton className="tw:h-full tw:w-full" />}>
          <RetentionPlot curve={data.curve} name={series} />
        </Suspense>
      </ChartFrame.Plot>
      <ChartFrame.Description>
        <table>
          <caption>{tOr('studio.retentionChart', {}, '')}</caption>
          <thead>
            <tr>
              <th scope="col">{tOr('studio.retentionPosition', {}, '')}</th>
              <th scope="col">{series}</th>
            </tr>
          </thead>
          <tbody>
            {data.curve.map(({ percent, viewers }) => (
              <tr key={percent}>
                <th scope="row">
                  <Format value={{ type: 'percent', value: percent }} />
                </th>
                <td>
                  <Format value={{ type: 'number', value: viewers }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartFrame.Description>
    </ChartFrame.Root>
  );
}
