import { Skeleton } from '@kit/ui';

const SKELETON_ROWS = ['first', 'second', 'third', 'fourth'];

export function ActivityListSkeleton() {
  return (
    <div data-slot="activity-list-skeleton" aria-hidden="true" className="flex flex-col">
      {SKELETON_ROWS.map((row) => (
        <div
          key={row}
          className="flex items-center gap-inline border-b-divider border-border py-2 last:border-b-0"
        >
          <Skeleton shape="circle" className="size-avatar-sm shrink-0" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton radius="xs" className="h-[1rem] w-3/4" />
            <Skeleton radius="xs" className="h-[0.75rem] w-1/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
