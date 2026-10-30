import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { ClipService } from '../services/index';
import { Services } from './service-tokens';

export function registerClipServices(c: Container): Container {
  return c.provide(
    Services.ClipService,
    (c) =>
      new ClipService({
        clips: c.get(Adapters.Repositories).clips,
        videos: c.get(Adapters.Repositories).videos,
        channels: c.get(Adapters.Repositories).channels,
        paginator: c.get(Services.Paginator),
        cdn: c.get(Adapters.Config).cdn,
        sprite: c.get(Adapters.Config).sprite,
        now: Date.now,
      })
  );
}
