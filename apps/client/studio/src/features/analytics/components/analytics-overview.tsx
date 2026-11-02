import type { AnalyticsRange, AnalyticsScope, KpiMetric } from '../types';
import { KpiCard } from './kpi-card';
import { NetSubscribersCard } from './net-subscribers-card';
import { ViewsChart } from './views-chart';

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
  return (
    <>
      <div className="tw:grid tw:grid-cols-2 tw:gap-stack tw:medium:grid-cols-3">
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
