import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { ChannelFeaturedService, ChannelService } from '../services/index';
import { Services } from './service-tokens';

export function registerChannelServices(c: Container): Container {
  return c
    .provide(
      Services.ChannelService,
      (c) =>
        new ChannelService({
          users: c.get(Adapters.Repositories).users,
          channels: c.get(Adapters.Repositories).channels,
          playlists: c.get(Adapters.Repositories).playlists,
          videoService: c.get(Services.VideoService),
          paginator: c.get(Services.Paginator),
          cdn: c.get(Adapters.Config).cdn,
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
