import type { Video } from '@vp/api-contracts';
import { canReadVideoStats } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { LazyStatsPanel } from './stats-panel.lazy';

/** What the channel's team sees above a video's description: its numbers, its drop-offs and the quick edits; nothing, and no request, for anyone else. */
export function CreatorStatsPanel({ video }: { video: Video }) {
  const canRead = useCan(canReadVideoStats, { video: { ownerId: video.ownerId } });

  return canRead ? <LazyStatsPanel video={video} /> : null;
}
