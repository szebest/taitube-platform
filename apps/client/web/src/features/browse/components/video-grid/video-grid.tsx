import type { VideoSummary } from '@vp/api-contracts';

import { VideoCardSkeleton } from '#app/components/video/video-card';
import { FeedVideoCard } from '../feed-video-card';

const GRID =
  'tw:m-0 tw:grid tw:list-none tw:grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] tw:gap-x-grid-x tw:gap-y-grid-y tw:p-0';

const SKELETON_KEYS = Array.from({ length: 12 }, (_, index) => `skeleton-${index}`);

export interface VideoGridProps {
  videos: VideoSummary[];
}

export function VideoGrid({ videos }: VideoGridProps) {
  return (
    <ul className={GRID}>
      {videos.map((video) => (
        <li key={video.id}>
          <FeedVideoCard video={video} />
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
          <VideoCardSkeleton variant="grid" />
        </li>
      ))}
    </ul>
  );
}
