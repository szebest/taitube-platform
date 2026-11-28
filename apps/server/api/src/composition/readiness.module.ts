import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { ReadinessService } from '../services/readiness-service';
import { Services } from './service-tokens';

/** What `/readyz` asks: the stores always, the media server only while voice is on. */
export function registerReadiness(c: Container): Container {
  return c.provide(
    Services.Readiness,
    (c) =>
      new ReadinessService({
        postgres: c.get(Adapters.DbClient),
        redis: c.get(Adapters.Cache),
        s3: c.get(Adapters.Storage),
        ...(c.get(Adapters.Config).voice.enabled ? { voice: c.get(Adapters.VoiceGateway) } : {}),
      })
  );
}
