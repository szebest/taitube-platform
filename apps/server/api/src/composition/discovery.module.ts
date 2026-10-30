import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { Singleflight } from '@vp/concurrency';
import {
  DiscoveryShelves,
  FeedService,
  HomeService,
  RecommendationFeedbackService,
  RelatedService,
} from '../services/index';
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
          feedback: repositories().recommendationFeedback,
        })
    )
    .provide(
      Services.DiscoveryShelves,
      (c) =>
        new DiscoveryShelves({
          searchHistory: repositories().searchHistory,
          search: c.get(Services.SearchService),
          rising: repositories().rising,
          videoService: c.get(Services.VideoService),
          now: Date.now,
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
          feedback: repositories().recommendationFeedback,
          discovery: c.get(Services.DiscoveryShelves),
          viewerProgress: c.get(Services.ViewerProgress),
          cache: c.get(Adapters.Cache),
        })
    )
    .provide(
      Services.RecommendationFeedbackService,
      (c) =>
        new RecommendationFeedbackService({
          feedback: repositories().recommendationFeedback,
          videos: repositories().videos,
          channels: repositories().channels,
          home: c.get(Services.HomeService),
          paginator: c.get(Services.Paginator),
          cdn: config().cdn,
          sprite: config().sprite,
          now: Date.now,
        })
    );
}
