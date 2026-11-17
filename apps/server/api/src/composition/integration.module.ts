import { randomBytes } from 'node:crypto';
import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import {
  ApiTokenService,
  ChannelExportService,
  OEmbedService,
  WebhookService,
} from '../services/index';
import { nodeApiTokenSecrets } from './api-token-secrets';
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
          dispatcher: c.get(Adapters.WebhookDispatcher),
          newSecret: () => randomBytes(32).toString('hex'),
          now: Date.now,
        })
    )
    .provide(
      Services.ChannelExportService,
      (c) =>
        new ChannelExportService({
          exports: c.get(Adapters.Repositories).dataExports,
          storage: c.get(Adapters.Storage),
          bucket: c.get(Adapters.Config).buckets.raw,
          downloadTtlSeconds: c.get(Adapters.Config).limits.presignTtlSeconds,
          paginator: c.get(Services.Paginator),
          now: Date.now,
        })
    )
    .provide(
      Services.ApiTokenService,
      (c) =>
        new ApiTokenService({
          tokens: c.get(Adapters.Repositories).apiTokens,
          secrets: nodeApiTokenSecrets,
          now: Date.now,
        })
    );
}
