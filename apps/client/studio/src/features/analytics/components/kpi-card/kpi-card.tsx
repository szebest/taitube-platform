import type { FormatValue } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import type { ChartSeries } from '#app/components/analytics/chart-frame';
import { StatCard } from '#app/components/analytics/stat-card';
import { type KpiChangeUnit, kpiChange } from '#app/features/analytics/api/kpi-change';
import { kpiSeries } from '#app/features/analytics/api/kpi-series';
import { useAnalytics } from '#app/features/analytics/hooks/use-analytics';
import type { AnalyticsRange, AnalyticsScope, KpiMetric } from '#app/features/analytics/types';
import { KpiDelta } from '../kpi-delta/kpi-delta';

interface KpiPresentation {
  series: ChartSeries;
  value: (total: number) => FormatValue;
  change: KpiChangeUnit;
}

const words = (value: number): FormatValue => ({
  type: 'duration',
  value,
  options: { style: 'words', unitDisplay: 'short' },
});

const KPI_PRESENTATION = {
  views: { series: 0, value: (value) => ({ type: 'count', value }), change: 'percent' },
  'watch-time': { series: 1, value: words, change: 'percent' },
  'average-view-duration': { series: 2, value: words, change: 'percent' },
} as const satisfies Record<KpiMetric, KpiPresentation>;

export interface KpiCardProps {
  metric: KpiMetric;
  range: AnalyticsRange;
  scope: AnalyticsScope;
}

export function KpiCard({ metric, range, scope }: KpiCardProps) {
  const { tOr } = useT();
  const { data, isPending, isError, refetch } = useAnalytics(scope, range);
  const { series, value, change } = KPI_PRESENTATION[metric];

  const label = <StatCard.Label>{tOr('studio.kpiLabel', { metric, range }, '')}</StatCard.Label>;

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

  const { total, daily, previous } = kpiSeries(metric, data);

  return (
    <StatCard.Root state={data.rangeViews === 0 ? 'empty' : 'ready'}>
      {label}
      <StatCard.Value>
        <Format value={value(total)} />
      </StatCard.Value>
      <KpiDelta change={kpiChange(total, previous, change)} />
      <StatCard.Spark values={daily} series={series} />
    </StatCard.Root>
  );
}
