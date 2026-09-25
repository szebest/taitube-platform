import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { BootstrapService } from '../services/bootstrap-service';
import { Services } from './service-tokens';

export function registerBootstrap(c: Container): Container {
  return c.provide(
    Services.BootstrapService,
    (c) =>
      new BootstrapService({
        channelService: c.get(Services.ChannelService),
        categoryService: c.get(Services.CategoryService),
        featureFlags: c.get(Adapters.Config).featureFlags,
      })
  );
}
