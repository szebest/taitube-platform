import { PageHeaderSkeleton, VideoCardSkeleton } from '@vp/components';

export function PlaylistsPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-section">
      <PageHeaderSkeleton />
      <VideoCardSkeleton variant="grid" count={4} />
    </div>
  );
}
