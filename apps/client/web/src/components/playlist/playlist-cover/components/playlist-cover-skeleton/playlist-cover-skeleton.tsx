import { Skeleton } from '@kit/ui';

export function PlaylistCoverSkeleton() {
  return (
    <Skeleton data-slot="playlist-cover-skeleton" radius="thumb" className="aspect-video w-full" />
  );
}
