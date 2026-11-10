import type { PartyQueueView } from '@vp/api-contracts';
import type { QueueSnapshot, VideoRecord } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { all, map, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { type PartyVideoView, toPartyVideoView } from './watch-party-views';

type QueueViewDeps = Pick<WatchPartyDeps, 'repositories' | 'cdn'>;

function missingVideo(videoId: string): PartyVideoView {
  return { id: videoId, title: null, durationMs: null, thumbnailUrl: null };
}

/** The queue with each item's video: a video that is gone shows as an item with no title. */
export async function presentQueue(
  { repositories, cdn }: QueueViewDeps,
  { items, version }: QueueSnapshot
): Promise<Result<PartyQueueView, DatabaseUnavailable>> {
  const videoIds = [...new Set(items.map(({ videoId }) => videoId))];
  const found = all(await Promise.all(videoIds.map((id) => repositories.videos.findById(id))));
  return map(found, (videos) => {
    const byId = new Map<string, VideoRecord>(
      videos.flatMap((video) => (video === null ? [] : [[video.id, video] as const]))
    );
    return {
      version,
      items: items.map((item) => {
        const video = byId.get(item.videoId);
        return {
          id: item.id,
          video: video === undefined ? missingVideo(item.videoId) : toPartyVideoView(video, cdn),
          addedBy: item.addedBy,
          startMs: item.startMs,
          playedAt: item.playedAt?.toISOString() ?? null,
        };
      }),
    };
  });
}
