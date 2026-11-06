import { Card, Skeleton } from '@vp/ui';

import { StatCard } from '#app/components/analytics/stat-card';

/** The dashboard's loaded layout in grey: the header, the three figures, the chart and the two columns. */
export function LiveDashboardSkeleton() {
  return (
    <div aria-hidden="true" className="tw:flex tw:flex-col tw:gap-section">
      <Skeleton className="tw:h-[2.5rem] tw:w-[16rem]" />
      <div className="tw:grid tw:grid-cols-1 tw:gap-stack tw:medium:grid-cols-3">
        <StatCard.Root state="loading" />
        <StatCard.Root state="loading" />
        <StatCard.Root state="loading" />
      </div>
      <Skeleton className="tw:h-[16rem] tw:w-full" />
      <div className="tw:grid tw:gap-stack tw:large:grid-cols-2">
        <Card.Root>
          <Skeleton className="tw:h-[28rem] tw:w-full" />
        </Card.Root>
        <Card.Root>
          <Skeleton className="tw:h-[28rem] tw:w-full" />
        </Card.Root>
      </div>
    </div>
  );
}
