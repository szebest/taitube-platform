import { Format, useT } from '@vp/intl-react';
import type { ViewerSample } from '@vp/queries';
import { Skeleton } from '@vp/ui';
import { Suspense } from 'react';
import { ChartFrame } from '#app/components/analytics/chart-frame';
import { LazyLiveViewersPlot } from './live-viewers-plot.lazy';

const MIN_SAMPLES = 2;

export interface LiveViewersChartProps {
  samples: readonly ViewerSample[];
}

export function LiveViewersChart({ samples }: LiveViewersChartProps) {
  const { tOr } = useT();
  const series = tOr('studio.liveChartSeries', {}, '');
  const points = samples.map(({ at, viewers }) => ({ at: new Date(at).toISOString(), viewers }));

  return (
    <ChartFrame.Root state={samples.length < MIN_SAMPLES ? 'empty' : 'ready'}>
      <ChartFrame.Title>{tOr('studio.liveChartTitle', {}, '')}</ChartFrame.Title>
      <ChartFrame.Legend>
        <ChartFrame.LegendItem series={0}>{series}</ChartFrame.LegendItem>
      </ChartFrame.Legend>
      <ChartFrame.Plot>
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <LazyLiveViewersPlot points={points} name={series} />
        </Suspense>
      </ChartFrame.Plot>
      <ChartFrame.Description>
        <table>
          <thead>
            <tr>
              <th scope="col">{tOr('studio.liveChartColumnTime', {}, '')}</th>
              <th scope="col">{tOr('studio.liveChartColumnViewers', {}, '')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map(({ at, viewers }) => (
              <tr key={at}>
                <th scope="row">
                  <Format value={{ type: 'time', value: at }} />
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
