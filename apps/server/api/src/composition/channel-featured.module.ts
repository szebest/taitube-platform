import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { ChannelFeaturedService } from '../services/index';
import { Services } from './service-tokens';

export function registerChannelFeaturedServices(c: Container): Container {
  return c.provide(
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
