import { Format, useT } from '@kit/intl-react';
import { useQuery } from '@tanstack/react-query';
import { seriesColor } from '@vp/components';
import { useApi } from '@vp/queries';
import { ChartFrame } from '#app/components/analytics/chart-frame';
import { videoAudienceQueryOptions } from '#app/features/analytics/api/analytics-queries';
import type { AnalyticsRange } from '#app/features/analytics/types';
import { type DeviceRow, visibleDevices } from '#app/features/analytics/utils/visible-devices';

export interface DeviceSplitProps {
  videoId: string;
  range: AnalyticsRange;
}

export function DeviceSplit({ videoId, range }: DeviceSplitProps) {
  const { tOr } = useT();
  const api = useApi();
  const { data, isPending, isError, refetch } = useQuery(
    videoAudienceQueryOptions(api, videoId, range)
  );
  const title = tOr('studio.deviceSplitTitle', {}, '');

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

  const rows = visibleDevices(data.devices);
  const counted = rows.some(({ views }) => views > 0);
  const name = (device: DeviceRow['device']) => tOr('studio.deviceName', { device }, '');

  return (
    <ChartFrame.Root state={counted ? 'ready' : 'empty'}>
      <ChartFrame.Title>{title}</ChartFrame.Title>
      <ChartFrame.Plot>
        <ul aria-hidden="true" className="m-0 flex list-none flex-col gap-stack p-0">
          {rows.map(({ device, views, share }) => (
            <li key={device} className="flex flex-col gap-inline">
              <div className="flex justify-between gap-stack text-label">
                <span>{name(device)}</span>
                <span className="text-fg-muted">
                  <Format value={{ type: 'percent', value: share * 100 }} />
                  {' · '}
                  <Format value={{ type: 'number', value: views }} />
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share * 100}%`, background: seriesColor(0) }}
                />
              </div>
            </li>
          ))}
        </ul>
      </ChartFrame.Plot>
      <ChartFrame.Description>
        <table>
          <thead>
            <tr>
              <th scope="col">{tOr('studio.deviceColumn', {}, '')}</th>
              <th scope="col">{tOr('studio.chartColumnViews', {}, '')}</th>
              <th scope="col">{tOr('studio.deviceShareColumn', {}, '')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ device, views, share }) => (
              <tr key={device}>
                <th scope="row">{name(device)}</th>
                <td>
                  <Format value={{ type: 'number', value: views }} />
                </td>
                <td>
                  <Format value={{ type: 'percent', value: share * 100 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartFrame.Description>
    </ChartFrame.Root>
  );
}
