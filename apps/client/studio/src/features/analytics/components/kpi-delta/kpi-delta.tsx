import { StatCard } from '@kit/components';
import { useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import type { KpiChange } from '#app/features/analytics/api/kpi-change';

export interface KpiDeltaProps {
  change: KpiChange | null;
}

export function KpiDelta({ change }: KpiDeltaProps) {
  const { tOr } = useT();
  const { format } = useFormat();

  if (change === null) {
    return null;
  }

  return (
    <StatCard.Delta trend={change.trend}>
      {tOr('studio.kpiChange', { change: unwrapOr(format(change.value), '') }, '')}
    </StatCard.Delta>
  );
}
