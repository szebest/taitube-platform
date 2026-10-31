import type { ChannelFeaturedRepositoryPort, VideoRepository } from '@vp/core/repositories';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';

export class InMemoryChannelFeaturedRepository implements ChannelFeaturedRepositoryPort {
  private readonly pins = new Map<string, readonly string[]>();

  constructor(private readonly videos: Pick<VideoRepository, 'findById'>) {}

  async listForChannel(channelId: string): Promise<Result<string[], DatabaseUnavailable>> {
    return ok([...(this.pins.get(channelId) ?? [])]);
  }

  async replace(
    channelId: string,
    videoIds: readonly string[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    for (const videoId of videoIds) {
      const found = await this.videos.findById(videoId);
      if (isErr(found)) return found;
      if (!found.value) {
        return err(databaseUnavailable.during('replaceFeaturedVideos')(`video ${videoId} is gone`));
      }
    }
    this.pins.set(channelId, [...videoIds]);
    return ok();
  }

  clear(): void {
    this.pins.clear();
  }
}
