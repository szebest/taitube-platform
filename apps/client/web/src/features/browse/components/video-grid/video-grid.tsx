import type { VideoSummary } from '@vp/api-contracts';

import { VideoCard, VideoCardSkeleton } from '../video-card/video-card';

const GRID =
  'tw:m-0 tw:grid tw:list-none tw:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] tw:gap-x-4 tw:gap-y-8 tw:p-0';

const SKELETON_KEYS = Array.from({ length: 12 }, (_, index) => `skeleton-${index}`);

export interface VideoGridProps {
  videos: VideoSummary[];
}

export function VideoGrid({ videos }: VideoGridProps) {
  return (
    <ul className={GRID}>
      {videos.map((video) => (
        <li key={video.id}>
          <VideoCard video={video} />
        </li>
      ))}
    </ul>
  );
}

export function VideoGridSkeleton() {
  return (
    <ul aria-hidden="true" className={GRID}>
      {SKELETON_KEYS.map((key) => (
        <li key={key}>
          <VideoCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
