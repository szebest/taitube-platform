import { type AnalyticsRange, type AnalyticsScope, KPI_METRICS } from '../types';
import { KpiCard } from './kpi-card';
import { ViewsChart } from './views-chart';

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
      </div>
      <ViewsChart scope={scope} range={range} />
    </>
  );
}
