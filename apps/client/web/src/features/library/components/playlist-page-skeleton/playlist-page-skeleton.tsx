import { PageHeaderSkeleton, VideoCardSkeleton } from '@kit/components';

export function PlaylistPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-section">
      <PageHeaderSkeleton />
      <VideoCardSkeleton variant="row" count={4} />
    </div>
  );
}
