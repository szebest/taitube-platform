import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { Singleflight } from '@vp/concurrency';
import { FeedService, HomeService, RelatedService } from '../services/index';
import { HistoryPause } from '../services/history-pause';
import { ViewerProgress } from '../services/viewer-progress';
import { Services } from './service-tokens';

export function registerDiscoveryServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(Services.ViewerProgress, () => new ViewerProgress(repositories().watchHistory))
    .provide(Services.HistoryPause, () => new HistoryPause(repositories().userPreferences))
    .provide(
      Services.FeedService,
      (c) =>
        new FeedService({
          videoService: c.get(Services.VideoService),
          viewerProgress: c.get(Services.ViewerProgress),
          cache: c.get(Adapters.Cache),
          singleflight: new Singleflight(),
          ...config().httpCache.feed,
        })
    )
    .provide(
      Services.RelatedService,
      (c) =>
        new RelatedService({
          videos: repositories().videos,
          related: repositories().related,
          videoService: c.get(Services.VideoService),
          viewerProgress: c.get(Services.ViewerProgress),
        })
    )
    .provide(
      Services.HomeService,
      (c) =>
        new HomeService({
          videoService: c.get(Services.VideoService),
          related: c.get(Services.RelatedService),
          history: repositories().watchHistory,
          subscriptions: repositories().subscriptions,
          categories: repositories().categories,
          viewerProgress: c.get(Services.ViewerProgress),
          cache: c.get(Adapters.Cache),
        })
    );
}
