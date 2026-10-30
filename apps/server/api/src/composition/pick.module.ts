import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { CurrentPickCache } from '../services/current-pick-cache';
import { PickService } from '../services/index';
import { Services } from './service-tokens';

export function registerPickServices(c: Container): Container {
  return c.provide(Services.PickService, (c) => {
    const { httpCache } = c.get(Adapters.Config);
    return new PickService({
      picks: c.get(Adapters.Repositories).picks,
      videos: c.get(Adapters.Repositories).videos,
      channels: c.get(Adapters.Repositories).channels,
      feed: c.get(Services.FeedService),
      currentCache: new CurrentPickCache(c.get(Adapters.Cache), httpCache.feed.maxAgeSeconds),
      cdn: c.get(Adapters.Config).cdn,
      sprite: c.get(Adapters.Config).sprite,
      ...httpCache.feed,
      now: Date.now,
    });
  });
}
