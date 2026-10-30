import type {
  RelatedVideo,
  RelatedVideosOptions,
  RelatedVideosRepositoryPort,
  VideoRecord,
} from '@vp/core/repositories';
import { compareRelated, isPublicFeedEligible } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

export interface RelatedVideosLookups {
  videosRepo: { getAllVideos(): VideoRecord[] };
  historyRepo: { coWatchers(videoId: string): Map<string, number> };
}

export class InMemoryRelatedVideosRepository implements RelatedVideosRepositoryPort {
  constructor(private readonly lookups: RelatedVideosLookups) {}

  async find(options: RelatedVideosOptions): Promise<Result<RelatedVideo[], DatabaseUnavailable>> {
    const coWatchers = this.lookups.historyRepo.coWatchers(options.videoId);
    const tags = new Set(options.tags);

    const found = this.lookups.videosRepo
      .getAllVideos()
      .filter(
        (video) =>
          video.id !== options.videoId &&
          video.ownerId !== options.excludeOwnerId &&
          isPublicFeedEligible(video)
      )
      .map((video) => ({
        video,
        signals: {
          coWatchers: coWatchers.get(video.id) ?? 0,
          sharedTags: (video.tags ?? []).filter((tag) => tags.has(tag)).length,
          sameChannel: video.ownerId === options.ownerId,
          sameCategory: options.categoryId !== null && video.categoryId === options.categoryId,
        },
      }))
      .filter(({ signals }) => Object.values(signals).some(Boolean))
      .sort((a, b) =>
        compareRelated(
          { id: a.video.id, viewsCount: a.video.viewsCount ?? 0, signals: a.signals },
          { id: b.video.id, viewsCount: b.video.viewsCount ?? 0, signals: b.signals }
        )
      );

    return ok(found.slice(0, options.limit));
  }

  clear(): void {}
}
