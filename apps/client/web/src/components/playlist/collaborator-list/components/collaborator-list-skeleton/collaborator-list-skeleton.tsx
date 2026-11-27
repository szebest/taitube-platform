import { Skeleton } from '@kit/ui';

const SKELETON_ROWS = ['first', 'second', 'third'];

export function CollaboratorListSkeleton() {
  return (
    <div data-slot="collaborator-list-skeleton" aria-hidden="true" className="flex flex-col gap-1">
      {SKELETON_ROWS.map((row) => (
        <div key={row} className="flex items-center gap-inline p-1">
          <Skeleton shape="circle" className="size-avatar-md shrink-0" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton radius="xs" className="h-[1rem] w-1/3" />
            <Skeleton radius="xs" className="h-[0.75rem] w-1/4" />
          </div>
          <Skeleton radius="control" className="h-control-sm w-[6rem] shrink-0" />
        </div>
      ))}
    </div>
  );
}
