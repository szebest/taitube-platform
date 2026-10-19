import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { CreatorStudioService } from '../services/index';
import { Services } from './service-tokens';

export function registerStudioServices(c: Container): Container {
  return c.provide(
    Services.CreatorStudioService,
    (c) =>
      new CreatorStudioService({
        videos: c.get(Adapters.Repositories).videos,
        studio: c.get(Adapters.Repositories).videoStudio,
        videoService: c.get(Services.VideoService),
        channels: c.get(Adapters.Repositories).channels,
        cdn: c.get(Adapters.Config).cdn,
        sprite: c.get(Adapters.Config).sprite,
        paginator: c.get(Services.Paginator),
      })
  );
}
