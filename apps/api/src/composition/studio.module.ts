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
        cdn: c.get(Adapters.Config).cdn,
        paginator: c.get(Services.Paginator),
      })
  );
}
