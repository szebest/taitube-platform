import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { ViewerActivityService } from '../services/index';
import { Services } from './service-tokens';

export function registerActivityServices(c: Container): Container {
  return c.provide(
    Services.ViewerActivityService,
    (c) =>
      new ViewerActivityService({
        reactions: c.get(Adapters.Repositories).videoReactions,
        comments: c.get(Adapters.Repositories).comments,
        viewerProgress: c.get(Services.ViewerProgress),
        paginator: c.get(Services.Paginator),
        cdn: c.get(Adapters.Config).cdn,
        sprite: c.get(Adapters.Config).sprite,
      })
  );
}
