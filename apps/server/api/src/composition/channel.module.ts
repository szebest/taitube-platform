import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { ChannelFeaturedService, ChannelImageService, ChannelService } from '../services/index';
import { Services } from './service-tokens';

export function registerChannelServices(c: Container): Container {
  return c
    .provide(
      Services.ChannelImageService,
      (c) =>
        new ChannelImageService({
          channels: c.get(Adapters.Repositories).channels,
          storage: c.get(Adapters.Storage),
          publicBucket: c.get(Adapters.Config).buckets.public,
          cdn: c.get(Adapters.Config).cdn,
          presignedUrlTtlSeconds: c.get(Adapters.Config).limits.presignTtlSeconds,
        })
    )
    .provide(
      Services.ChannelService,
      (c) =>
        new ChannelService({
          users: c.get(Adapters.Repositories).users,
          channels: c.get(Adapters.Repositories).channels,
          captions: c.get(Adapters.Repositories).captions,
          liveStreams: c.get(Adapters.Repositories).liveStreams,
          playlists: c.get(Adapters.Repositories).playlists,
          videoService: c.get(Services.VideoService),
          paginator: c.get(Services.Paginator),
          cdn: c.get(Adapters.Config).cdn,
          images: c.get(Services.ChannelImageService),
        })
    )
    .provide(
      Services.ChannelFeaturedService,
      (c) =>
        new ChannelFeaturedService({
          channels: c.get(Adapters.Repositories).channels,
          featured: c.get(Adapters.Repositories).channelFeatured,
          videos: c.get(Adapters.Repositories).videos,
          videoService: c.get(Services.VideoService),
        })
    );
}
