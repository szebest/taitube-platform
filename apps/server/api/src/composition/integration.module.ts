import { randomBytes } from 'node:crypto';
import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { OEmbedService, WebhookService } from '../services/index';
import { Services } from './service-tokens';

export function registerIntegrationServices(c: Container): Container {
  return c
    .provide(
      Services.OEmbedService,
      (c) =>
        new OEmbedService({
          videos: c.get(Adapters.Repositories).videos,
          channels: c.get(Adapters.Repositories).channels,
          cdn: c.get(Adapters.Config).cdn,
          webUrl: c.get(Adapters.Config).webUrl,
        })
    )
    .provide(
      Services.WebhookService,
      (c) =>
        new WebhookService({
          webhooks: c.get(Adapters.Repositories).webhooks,
          policy: { allowPrivateHosts: c.get(Adapters.Config).webhooks.allowPrivateHosts },
          newSecret: () => randomBytes(32).toString('hex'),
          now: Date.now,
        })
    );
}
