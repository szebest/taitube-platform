import type { ChannelFeaturedView } from '@vp/api-contracts';
import type {
  ChannelFeaturedRepositoryPort,
  ChannelRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import { type Channel, FEATURED_VIDEOS_MAX, type Video } from '@vp/domain';
import {
  type ChannelNotFound,
  channelNotFound,
  decideFeaturedVideos,
  type FeaturedVideosFailure,
  isFeaturable,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { all, andThen, andThenAsync, err, map, type Result } from '@vp/result';
import { type InvalidFeaturedSelection, validateFeaturedSelection } from '@vp/validation';
import { findChannelByIdOrHandle } from './channel-lookup';
import type { VideoService } from './video-service';

export interface ChannelFeaturedServiceDeps {
  channels: ChannelRepositoryPort;
  featured: ChannelFeaturedRepositoryPort;
  videos: VideoRepository;
  videoService: Pick<VideoService, 'summarize'>;
}

export type GetChannelFeaturedFailure = ChannelNotFound | DatabaseUnavailable;
export type SetChannelFeaturedFailure =
  | GetChannelFeaturedFailure
  | InvalidFeaturedSelection
  | FeaturedVideosFailure;

/**
 * The channel's Start here shelf. What a visitor sees is decided here and nowhere else: the
 * creator's pins that still qualify, else the most-viewed public uploads.
 */
export class ChannelFeaturedService {
  constructor(private readonly deps: ChannelFeaturedServiceDeps) {}

  async get(idOrHandle: string): Promise<Result<ChannelFeaturedView, GetChannelFeaturedFailure>> {
    const channel = await findChannelByIdOrHandle(this.deps.channels, idOrHandle);
    return andThenAsync(channel, (found) => this.shelf(found));
  }

  async replace(
    caller: UserContext,
    videoIds: readonly string[]
  ): Promise<Result<ChannelFeaturedView, SetChannelFeaturedFailure>> {
    const channel = await this.deps.channels.findByUserId(caller.id);
    return andThenAsync(channel, async (found) => {
      if (!found) return err(channelNotFound(caller.id));
      const selection = validateFeaturedSelection(videoIds, FEATURED_VIDEOS_MAX);
      return andThenAsync(selection, (ids) => this.save(caller, found, ids));
    });
  }

  private async save(
    caller: UserContext,
    channel: Channel,
    videoIds: readonly string[]
  ): Promise<Result<ChannelFeaturedView, SetChannelFeaturedFailure>> {
    const loaded = await this.load(videoIds);
    const decided = andThen(loaded, (videos) =>
      decideFeaturedVideos({
        viewer: caller,
        channelOwnerId: channel.userId,
        videoIds,
        videos: new Map(videos.map((video) => [video.id, video])),
      })
    );
    return andThenAsync(decided, async (ids) => {
      const stored = await this.deps.featured.replace(channel.id, ids);
      return andThenAsync(stored, () => this.shelf(channel));
    });
  }

  private async shelf(channel: Channel): Promise<Result<ChannelFeaturedView, DatabaseUnavailable>> {
    const ids = await this.deps.featured.listForChannel(channel.id);
    const pinned = await andThenAsync(ids, (found) => this.load(found));
    return andThenAsync(pinned, async (videos) => {
      const showing = videos.filter(isFeaturable);
      if (showing.length > 0) return this.present('pinned', showing);
      const popular = await this.mostViewed(channel);
      return andThenAsync(popular, (found) => this.present('popular', found));
    });
  }

  private async mostViewed(channel: Channel): Promise<Result<Video[], DatabaseUnavailable>> {
    const found = await this.deps.videos.listPublic({
      ownerId: channel.userId,
      format: 'standard',
      sort: 'popular',
      limit: FEATURED_VIDEOS_MAX,
    });
    return map(found, ({ items }) => items.slice(0, FEATURED_VIDEOS_MAX));
  }

  private async present(
    source: ChannelFeaturedView['source'],
    videos: Video[]
  ): Promise<Result<ChannelFeaturedView, DatabaseUnavailable>> {
    return map(await this.deps.videoService.summarize(videos), (items) => ({ source, items }));
  }

  /** The videos that exist, in the order asked for; a missing id is left out. */
  private async load(videoIds: readonly string[]): Promise<Result<Video[], DatabaseUnavailable>> {
    const found = all(await Promise.all(videoIds.map((id) => this.deps.videos.findById(id))));
    return map(found, (videos) => videos.filter((video) => video !== null));
  }
}
