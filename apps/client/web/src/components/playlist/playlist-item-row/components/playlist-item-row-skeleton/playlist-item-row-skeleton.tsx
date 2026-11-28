import { Skeleton } from '@kit/ui';

export function PlaylistItemRowSkeleton() {
  return (
    <div
      data-slot="playlist-item-row-skeleton"
      aria-hidden="true"
      className="flex items-center gap-inline p-1"
    >
      <Skeleton radius="thumb" className="h-[4.21875rem] w-[7.5rem] shrink-0" />
      <div className="flex flex-1 flex-col gap-inline">
        <Skeleton radius="xs" className="h-[1rem] w-full" />
        <Skeleton radius="xs" className="h-[1rem] w-2/3" />
      </div>
      <Skeleton shape="circle" className="size-avatar-xs shrink-0" />
    </div>
  );
}
