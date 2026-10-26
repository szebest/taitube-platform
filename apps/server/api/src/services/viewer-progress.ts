import type { WatchHistoryRepositoryPort } from '@vp/core/repositories';
import type { UserContext } from '@vp/permissions';
import { isErr } from '@vp/result';
import type { VideoSummaryView, ViewerProgressView } from './video-views';

/** One batched read decorates a whole page of cards with how far the signed-in caller got. */
export class ViewerProgress {
  constructor(private readonly history: WatchHistoryRepositoryPort) {}

  async attach<T extends Pick<VideoSummaryView, 'id'>>(
    viewer: UserContext | null,
    videos: readonly T[]
  ): Promise<Array<T & { viewer?: ViewerProgressView | null }>> {
    if (!viewer || videos.length === 0) return [...videos];

    const found = await this.history.findMany(
      viewer.id,
      videos.map(({ id }) => id)
    );
    // A failed read leaves the cards without a bar; it never fails the page they are on.
    if (isErr(found)) return [...videos];

    const byVideo = new Map(
      found.value.map(({ videoId, progressSeconds, watchedAt }) => [
        videoId,
        { progressSeconds, watchedAt: watchedAt.toISOString() },
      ])
    );
    return videos.map((video) => ({ ...video, viewer: byVideo.get(video.id) ?? null }));
  }
}
