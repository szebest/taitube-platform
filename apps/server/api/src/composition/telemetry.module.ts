import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { PlaybackTelemetryService, WebVitalsService } from '../services/index';
import { Services } from './service-tokens';

export function registerTelemetryServices(c: Container): Container {
  return c
    .provide(
      Services.WebVitalsService,
      (c) =>
        new WebVitalsService({
          metrics: c.get(Adapters.Metrics),
          maxRoutesPerApp: c.get(Adapters.Config).webVitals.maxRoutesPerApp,
        })
    )
    .provide(
      Services.PlaybackTelemetryService,
      (c) =>
        new PlaybackTelemetryService({
          viewBuffer: c.get(Adapters.ViewBuffer),
          metrics: c.get(Adapters.Metrics),
        })
    );
}
