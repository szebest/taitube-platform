import { Card, Skeleton } from '@vp/ui';
import { StatCard } from '#app/components/analytics/stat-card';

/** The dashboard's loaded layout in grey: the header, the three figures, the chart and the two columns. */
export function LiveDashboardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-section">
      <Skeleton className="h-[2.5rem] w-[16rem]" />
      <div className="grid grid-cols-1 gap-stack medium:grid-cols-3">
        <StatCard.Root state="loading" />
        <StatCard.Root state="loading" />
        <StatCard.Root state="loading" />
      </div>
      <Skeleton className="h-[16rem] w-full" />
      <div className="grid gap-stack large:grid-cols-2">
        <Card.Root>
          <Skeleton className="h-[28rem] w-full" />
        </Card.Root>
        <Card.Root>
          <Skeleton className="h-[28rem] w-full" />
        </Card.Root>
      </div>
    </div>
  );
}
