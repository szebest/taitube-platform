import { EmptyState } from '@kit/components';
import { Format, useT } from '@kit/intl-react';
import { Skeleton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { Suspense } from 'react';
import { ChartFrame } from '#app/components/analytics/chart-frame';
import { videoBenchmarkQueryOptions } from '#app/features/analytics/api/analytics-queries';
import type { BenchmarkPoint } from '../benchmark-plot/benchmark-plot';
import { LazyBenchmarkPlot } from '../benchmark-plot/benchmark-plot.lazy';

export interface BenchmarkChartProps {
  videoId: string;
}

export function BenchmarkChart({ videoId }: BenchmarkChartProps) {
  const { tOr } = useT();
  const api = useApi();
  const { data, isPending, isError, refetch } = useQuery(videoBenchmarkQueryOptions(api, videoId));
  const title = tOr('studio.benchmarkTitle', {}, '');

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

  const dayLabel = (day: number) => tOr('studio.benchmarkDay', { day: day + 1 }, '');
  const points = data.days.flatMap(({ day, views, p25, median, p75 }): BenchmarkPoint[] =>
    p25 === null || median === null || p75 === null
      ? []
      : [{ day, views, median, band: [p25, p75] }]
  );
  const names = {
    views: tOr('studio.benchmarkViews', {}, ''),
    median: tOr('studio.benchmarkMedian', {}, ''),
    band: tOr('studio.benchmarkBand', {}, ''),
  };
  const count = (value: number | null) =>
    value === null ? null : <Format value={{ type: 'number', value }} />;

  return (
    <ChartFrame.Root state={data.publishedAt === null ? 'empty' : 'ready'}>
      <ChartFrame.Title>{title}</ChartFrame.Title>
      {points.length > 0 && (
        <ChartFrame.Legend>
          <ChartFrame.LegendItem series={0}>{names.views}</ChartFrame.LegendItem>
          <ChartFrame.LegendItem series={1}>{names.median}</ChartFrame.LegendItem>
          <ChartFrame.LegendItem series={2}>{names.band}</ChartFrame.LegendItem>
        </ChartFrame.Legend>
      )}
      <ChartFrame.Plot>
        {points.length === 0 ? (
          <EmptyState.Root size="inline" className="justify-center">
            <EmptyState.Title>{tOr('studio.benchmarkEmpty', {}, '')}</EmptyState.Title>
          </EmptyState.Root>
        ) : (
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <LazyBenchmarkPlot points={points} names={names} dayLabel={dayLabel} />
          </Suspense>
        )}
      </ChartFrame.Plot>
      <ChartFrame.Description>
        <table>
          <thead>
            <tr>
              <th scope="col">{tOr('studio.benchmarkColumnDay', {}, '')}</th>
              <th scope="col">{tOr('studio.benchmarkColumnViews', {}, '')}</th>
              <th scope="col">{tOr('studio.benchmarkColumnP25', {}, '')}</th>
              <th scope="col">{tOr('studio.benchmarkColumnMedian', {}, '')}</th>
              <th scope="col">{tOr('studio.benchmarkColumnP75', {}, '')}</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map(({ day, views, p25, median, p75 }) => (
              <tr key={day}>
                <th scope="row">{dayLabel(day)}</th>
                <td>{count(views)}</td>
                <td>{count(p25)}</td>
                <td>{count(median)}</td>
                <td>{count(p75)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartFrame.Description>
    </ChartFrame.Root>
  );
}
