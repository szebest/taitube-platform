import type {
  ChannelRepositoryPort,
  RisingVideosOptions,
  RisingVideosRepositoryPort,
  VideoRecord,
  VideoViewRepositoryPort,
} from '@vp/core/repositories';
import { RISING, isPublicFeedEligible, rankRising } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok, unwrapOr } from '@vp/result';

export interface RisingVideosLookups {
  videosRepo: { getAllVideos(): VideoRecord[] };
  channelsRepo: Pick<ChannelRepositoryPort, 'findByUserId'>;
  viewsRepo: Pick<VideoViewRepositoryPort, 'retentionCurve'>;
}

export class InMemoryRisingVideosRepository implements RisingVideosRepositoryPort {
  constructor(private readonly lookups: RisingVideosLookups) {}

  async find({
    since,
    excludeOwnerId,
    excludeVideoIds,
    limit,
  }: RisingVideosOptions): Promise<Result<VideoRecord[], DatabaseUnavailable>> {
    const excluded = new Set(excludeVideoIds);
    const recent = this.lookups.videosRepo
      .getAllVideos()
      .filter(
        (video) =>
          video.createdAt >= since &&
          video.ownerId !== excludeOwnerId &&
          !excluded.has(video.id) &&
          isPublicFeedEligible(video)
      );

    const candidates = [];
    for (const video of recent) {
      const channel = unwrapOr(await this.lookups.channelsRepo.findByUserId(video.ownerId), null);
      if (!channel) continue;

      const curve = unwrapOr(await this.lookups.viewsRepo.retentionCurve(video.id), []);
      const viewersAt = (percent: number) =>
        curve.find((point) => point.percent === percent)?.viewers ?? 0;
      candidates.push({
        video,
        id: video.id,
        ownerId: video.ownerId,
        createdAt: video.createdAt,
        subscriberCount: channel.subscriberCount,
        sessions: viewersAt(RISING.startPercent),
        completed: viewersAt(RISING.completedPercent),
      });
    }
    return ok(rankRising(candidates, limit).map(({ video }) => video));
  }

  clear(): void {}
}
