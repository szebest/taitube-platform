import { Format, useT } from '@vp/intl-react';

import { StatCard } from '#app/components/analytics/stat-card';
import { kpiChange } from '../api/kpi-change';
import { useChannelAnalytics } from '../hooks/use-analytics';
import type { AnalyticsRange } from '../types';
import { KpiDelta } from './kpi-delta';

export interface NetSubscribersCardProps {
  range: AnalyticsRange;
}

/** Subscribers gained minus lost over the range, a channel figure with no daily series. */
export function NetSubscribersCard({ range }: NetSubscribersCardProps) {
  const { tOr } = useT();
  const { data, isPending, isError, refetch } = useChannelAnalytics(range);

  const label = (
    <StatCard.Label>
      {tOr('studio.kpiLabel', { metric: 'net-subscribers', range }, '')}
    </StatCard.Label>
  );

  if (isPending) {
    return <StatCard.Root state="loading" />;
  }

  if (isError) {
    return (
      <StatCard.Root state="error" onRetry={() => void refetch()}>
        {label}
        <StatCard.Value />
      </StatCard.Root>
    );
  }

  const { netSubscribers, previous } = data;

  return (
    <StatCard.Root>
      {label}
      <StatCard.Value>
        <Format
          value={{ type: 'number', value: netSubscribers, options: { signDisplay: 'exceptZero' } }}
        />
      </StatCard.Value>
      <KpiDelta change={kpiChange(netSubscribers, previous?.netSubscribers ?? null, 'count')} />
    </StatCard.Root>
  );
}
