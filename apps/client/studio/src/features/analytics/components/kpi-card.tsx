import type { FormatValue } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import type { ChartSeries } from '#app/components/analytics/chart-frame';
import { StatCard } from '#app/components/analytics/stat-card';
import { kpiSeries } from '../api/kpi-series';
import { useAnalytics } from '../hooks/use-analytics';
import type { AnalyticsRange, AnalyticsScope, KpiMetric } from '../types';

interface KpiPresentation {
  series: ChartSeries;
  value: (total: number) => FormatValue;
}

const words = (value: number): FormatValue => ({
  type: 'duration',
  value,
  options: { style: 'words', unitDisplay: 'short' },
});

const KPI_PRESENTATION = {
  views: { series: 0, value: (value) => ({ type: 'count', value }) },
  'watch-time': { series: 1, value: words },
  'average-view-duration': { series: 2, value: words },
} as const satisfies Record<KpiMetric, KpiPresentation>;

export interface KpiCardProps {
  metric: KpiMetric;
  range: AnalyticsRange;
  scope: AnalyticsScope;
}

export function KpiCard({ metric, range, scope }: KpiCardProps) {
  const { tOr } = useT();
  const { data, isPending, isError, refetch } = useAnalytics(scope, range);
  const { series, value } = KPI_PRESENTATION[metric];

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

  const { total, daily } = kpiSeries(metric, data.timeline);

  return (
    <StatCard.Root state={data.rangeViews === 0 ? 'empty' : 'ready'}>
      {label}
      <StatCard.Value>
        <Format value={value(total)} />
      </StatCard.Value>
      <StatCard.Spark values={daily} series={series} />
    </StatCard.Root>
  );
}
