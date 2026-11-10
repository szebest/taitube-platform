import { Adapters, queueNamed } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { MetadataScreening } from '../services/metadata-screening';
import { ScreeningCaseViews } from '../services/screening-case-views';
import { ScreeningService } from '../services/screening-service';
import { Services } from './service-tokens';

export function registerScreeningServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.MetadataScreening,
      () =>
        new MetadataScreening({
          screenings: repositories().screenings,
          videos: repositories().videos,
          enabled: config().screening.enabled,
          thresholds: config().screening.thresholds,
          locales: config().screening.process.metadataLocales,
          recentTitleCount: config().screening.process.recentTitleCount,
        })
    )
    .provide(
      Services.ScreeningService,
      (c) =>
        new ScreeningService({
          screenings: repositories().screenings,
          videos: repositories().videos,
          views: new ScreeningCaseViews({
            videos: repositories().videos,
            channels: repositories().channels,
            storage: c.get(Adapters.Storage),
            rawBucket: config().buckets.raw,
            frameUrlTtlSeconds: config().limits.presignTtlSeconds,
            cdn: config().cdn,
          }),
          packageQueue: queueNamed(c.get(Adapters.Queues), 'package'),
          paginator: c.get(Services.Paginator),
        })
    );
}
