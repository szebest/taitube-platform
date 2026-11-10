import { useAnalytics } from '#app/features/analytics/hooks/use-analytics';
import type { AnalyticsRange, AnalyticsScope, KpiMetric } from '#app/features/analytics/types';
import { AnalyticsEmpty } from '../analytics-empty/analytics-empty';
import { KpiCard } from '../kpi-card/kpi-card';
import { NetSubscribersCard } from '../net-subscribers-card/net-subscribers-card';
import { ViewsChart } from '../views-chart/views-chart';

const KPI_METRICS = [
  'views',
  'watch-time',
  'average-view-duration',
] as const satisfies readonly KpiMetric[];

export interface AnalyticsOverviewProps {
  scope: AnalyticsScope;
  range: AnalyticsRange;
}

export function AnalyticsOverview({ scope, range }: AnalyticsOverviewProps) {
  const { data } = useAnalytics(scope, range);

  if (data?.rangeViews === 0) {
    return <AnalyticsEmpty />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-stack medium:grid-cols-3">
        {KPI_METRICS.map((metric) => (
          <KpiCard key={metric} metric={metric} range={range} scope={scope} />
        ))}
        {scope.kind === 'channel' && <NetSubscribersCard range={range} />}
      </div>
      <ViewsChart scope={scope} range={range} granularity="day" />
      <ViewsChart scope={scope} range={range} granularity="hour" />
    </>
  );
}
