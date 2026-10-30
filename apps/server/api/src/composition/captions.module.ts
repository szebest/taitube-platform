import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { CaptionService, CaptionTrackService } from '../services/index';
import { Services } from './service-tokens';

export function registerCaptionServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.CaptionService,
      () =>
        new CaptionService({
          videos: repositories().videos,
          captions: repositories().captions,
          outbox: repositories().outbox,
          cdn: config().cdn,
          settings: {
            enabled: config().captions.enabled,
            modelVersion: config().captions.modelVersion,
          },
        })
    )
    .provide(
      Services.CaptionTrackService,
      (c) =>
        new CaptionTrackService({
          videos: repositories().videos,
          captions: repositories().captions,
          storage: c.get(Adapters.Storage),
          publicBucket: config().buckets.public,
          cdn: config().cdn,
        })
    );
}
