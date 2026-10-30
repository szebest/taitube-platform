import type { VideoRetention } from '@vp/api-contracts';

import { sequentialScale } from '#app/components/analytics/chart-frame';

type RetentionPoint = VideoRetention['curve'][number];

export function retentionCells(curve: readonly RetentionPoint[]) {
  const viewers = curve.map((point) => point.viewers);
  const fewest = Math.min(...viewers);
  const most = Math.max(...viewers);

  return curve.map((point) => ({ ...point, fill: sequentialScale(point.viewers, fewest, most) }));
}
