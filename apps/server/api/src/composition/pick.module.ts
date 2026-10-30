import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { CurrentPickCache } from '../services/current-pick-cache';
import { CurrentPickService, PickService } from '../services/index';
import { Services } from './service-tokens';

export function registerPickServices(c: Container): Container {
  return c
    .provide(Services.CurrentPickService, (c) => {
      const { httpCache, cdn, sprite } = c.get(Adapters.Config);
      return new CurrentPickService({
        picks: c.get(Adapters.Repositories).picks,
        feed: c.get(Services.FeedService),
        currentCache: new CurrentPickCache(c.get(Adapters.Cache), httpCache.feed.maxAgeSeconds),
        cdn,
        sprite,
        ...httpCache.feed,
        now: Date.now,
      });
    })
    .provide(Services.PickService, (c) => {
      const { httpCache, picks, cdn, sprite } = c.get(Adapters.Config);
      return new PickService({
        picks: c.get(Adapters.Repositories).picks,
        videos: c.get(Adapters.Repositories).videos,
        channels: c.get(Adapters.Repositories).channels,
        currentCache: new CurrentPickCache(c.get(Adapters.Cache), httpCache.feed.maxAgeSeconds),
        cdn,
        sprite,
        defaultRangeMs: picks.defaultRangeMs,
        now: Date.now,
      });
    });
}
