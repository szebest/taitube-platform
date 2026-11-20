import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { ClipService } from '../services/index';
import { registerIntegrationServices } from './integration.module';
import { Services } from './service-tokens';

export function registerClipServices(c: Container): Container {
  return registerIntegrationServices(c).provide(
    Services.ClipService,
    (c) =>
      new ClipService({
        clips: c.get(Adapters.Repositories).clips,
        videos: c.get(Adapters.Repositories).videos,
        channels: c.get(Adapters.Repositories).channels,
        paginator: c.get(Services.Paginator),
        cdn: c.get(Adapters.Config).cdn,
        sprite: c.get(Adapters.Config).sprite,
        gate: c.get(Services.VideoAccessGate),
        now: Date.now,
      })
  );
}
