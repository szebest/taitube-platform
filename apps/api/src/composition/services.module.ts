import { Adapters, queueNamed } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { Singleflight } from '@vp/concurrency';
import { createLogger } from '@vp/logger';
import { MetricsServer } from '@vp/observability';
import { Paginator } from '@vp/pagination';
import {
  AnalyticsService,
  CategoryService,
  ChannelService,
  CommentService,
  DlqService,
  FeedService,
  PlaylistService,
  QueueService,
  ReactionService,
  SseHub,
  SseService,
  SubscriptionService,
  UploadService,
  VideoService,
  ViewService,
  WatchHistoryService,
  registerHousekeepingSchedulers,
} from '../services/index';
import { Poller } from '../services/poller';
import { pollQueueMetrics } from '../services/queue-poller';
import { ReadinessService } from '../services/readiness-service';
import { pollSqlMetrics } from '../services/sql-poller';
import { bullBoardPlugin } from './bull-board';
import { Services } from './service-tokens';

export * from './service-tokens';

/**
 * Resolving them is what makes `start()` run them, in this order: the scrape endpoint first, so
 * the subscription, the pollers and the schedulers are measured from their first tick.
 */
export function resolveBackground(c: Container): void {
  c.get(Services.MetricsServer);
  c.get(Services.SseHub);
  c.get(Services.QueuePoller);
  c.get(Services.SqlPoller);
  c.get(Services.HousekeepingQueue);
}

export function registerServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(Services.Logger, () =>
      createLogger({ format: 'json', service: 'vp-api', level: config().logLevel })
    )
    .provide(Services.Paginator, () => new Paginator(config().pagination))
    .provide(
      Services.VideoService,
      (c) =>
        new VideoService({
          videos: repositories().videos,
          probeQueue: c.get(Adapters.ProbeQueue),
          cdn: config().cdn,
          reactionCache: c.get(Adapters.ReactionCache),
          authorization: c.get(Adapters.Authorization),
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.UploadService,
      (c) =>
        new UploadService({
          uploads: repositories().uploads,
          videos: repositories().videos,
          events: repositories().events,
          users: repositories().users,
          storage: c.get(Adapters.Storage),
          multipart: c.get(Adapters.Multipart),
          probeQueue: c.get(Adapters.ProbeQueue),
          rawBucket: config().buckets.raw,
          multipartThresholdBytes: config().limits.multipartThresholdBytes,
          partSizeMinBytes: config().limits.partSizeMinBytes,
          partSizeMaxBytes: config().limits.partSizeMaxBytes,
          presignedUrlTtlSeconds: config().limits.presignTtlSeconds,
          uploadSessionTtlSeconds: config().limits.uploadSessionTtlSeconds,
          maxInflightPerUser: config().limits.maxInflightPerUser,
        })
    )
    .provide(
      Services.FeedService,
      (c) =>
        new FeedService({
          videoService: c.get(Services.VideoService),
          cache: c.get(Adapters.Cache),
          singleflight: new Singleflight(),
          ...config().httpCache.feed,
        })
    )
    .provide(
      Services.CategoryService,
      (c) =>
        new CategoryService({
          categories: repositories().categories,
          categoryCache: c.get(Adapters.CategoryCache),
          ...config().httpCache.categories,
        })
    )
    .provide(
      Services.ChannelService,
      () =>
        new ChannelService({
          users: repositories().users,
          channels: repositories().channels,
          playlists: repositories().playlists,
        })
    )
    .provide(
      Services.ReactionService,
      (c) =>
        new ReactionService({
          videoReactions: repositories().videoReactions,
          reactionCache: c.get(Adapters.ReactionCache),
          videos: repositories().videos,
        })
    )
    .provide(
      Services.SubscriptionService,
      (c) =>
        new SubscriptionService({
          subscriptions: repositories().subscriptions,
          channels: repositories().channels,
          subscriptionCache: c.get(Adapters.SubscriptionCache),
          cdn: config().cdn,
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.CommentService,
      (c) =>
        new CommentService({
          comments: repositories().comments,
          videos: repositories().videos,
          commentCache: c.get(Adapters.CommentCache),
          singleflight: new Singleflight(),
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.ViewService,
      (c) =>
        new ViewService({
          viewBuffer: c.get(Adapters.ViewBuffer),
          metrics: c.get(Adapters.Metrics),
          limits: config().views,
          now: Date.now,
        })
    )
    .provide(
      Services.AnalyticsService,
      () =>
        new AnalyticsService({
          videos: repositories().videos,
          videoViews: repositories().videoViews,
          now: Date.now,
        })
    )
    .provide(
      Services.PlaylistService,
      () =>
        new PlaylistService({
          playlists: repositories().playlists,
          videos: repositories().videos,
          cdn: config().cdn,
        })
    )
    .provide(
      Services.WatchHistoryService,
      (c) =>
        new WatchHistoryService({
          history: repositories().watchHistory,
          videos: repositories().videos,
          playheads: c.get(Adapters.PlayheadCache),
          paginator: c.get(Services.Paginator),
          cdn: config().cdn,
          flushIntervalMs: config().caches.playheads.flushIntervalMs,
          now: Date.now,
        })
    )
    .provide(Services.QueueService, (c) => new QueueService({ queues: c.get(Adapters.Queues) }))
    .provide(Services.QueueBoard, (c) =>
      bullBoardPlugin({
        basePath: '/admin/queues',
        queues: c.get(Adapters.Queues).values(),
        boardQueues: c.get(Adapters.BoardQueues),
      })
    )
    .provide(
      Services.DlqService,
      (c) =>
        new DlqService({
          dlq: repositories().dlq,
          events: repositories().events,
          queues: c.get(Adapters.Queues),
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.SseService,
      () =>
        new SseService({
          videos: repositories().videos,
          renditions: repositories().renditions,
          events: repositories().events,
          cdn: config().cdn,
        })
    )
    .provide(
      Services.SseHub,
      (c) =>
        new SseHub({
          cache: c.get(Adapters.Cache),
          metrics: c.get(Adapters.Metrics),
          maxConnectionsPerUser: config().sse.maxPerUser,
          maxPodConnections: config().sse.maxPerPod,
          heartbeatMs: config().sse.heartbeatMs,
          idleTimeoutMs: config().sse.idleTimeoutMs,
        }),
      { start: (hub) => hub.init(), dispose: (hub) => hub.close() }
    )
    .provide(
      Services.Readiness,
      (c) =>
        new ReadinessService({
          postgres: c.get(Adapters.DbClient),
          redis: c.get(Adapters.Cache),
          s3: c.get(Adapters.Storage),
        })
    )
    .provide(
      Services.QueuePoller,
      (c) => {
        const queues = c.get(Adapters.Queues);
        const metrics = c.get(Adapters.Metrics);
        return new Poller(
          () => pollQueueMetrics(queues, metrics, Date.now),
          config().pollers.queueIntervalMs
        );
      },
      { start: (poller) => poller.start(), dispose: (poller) => poller.stop() }
    )
    .provide(
      Services.SqlPoller,
      (c) => {
        const metrics = c.get(Adapters.Metrics);
        return new Poller(
          () => pollSqlMetrics(repositories(), metrics, config().pollers.staleStepMs),
          config().pollers.sqlIntervalMs
        );
      },
      { start: (poller) => poller.start(), dispose: (poller) => poller.stop() }
    )
    .provide(
      Services.HousekeepingQueue,
      (c) => queueNamed(c.get(Adapters.Queues), 'housekeeping'),
      {
        start: (queue) =>
          registerHousekeepingSchedulers(queue, {
            flushIntervalMs: config().views.flushIntervalMs,
          }),
      }
    )
    .provide(
      Services.MetricsServer,
      (c) =>
        new MetricsServer({
          port: config().http.metricsPort,
          host: '0.0.0.0',
          registry: c.get(Adapters.Metrics).registry,
        }),
      { start: (server) => server.listen(), dispose: (server) => server.close() }
    )
    .provide(Services.ServiceSet, (c) => ({
      videoService: c.get(Services.VideoService),
      uploadService: c.get(Services.UploadService),
      feedService: c.get(Services.FeedService),
      categoryService: c.get(Services.CategoryService),
      channelService: c.get(Services.ChannelService),
      reactionService: c.get(Services.ReactionService),
      subscriptionService: c.get(Services.SubscriptionService),
      commentService: c.get(Services.CommentService),
      viewService: c.get(Services.ViewService),
      analyticsService: c.get(Services.AnalyticsService),
      playlistService: c.get(Services.PlaylistService),
      watchHistoryService: c.get(Services.WatchHistoryService),
      queueService: c.get(Services.QueueService),
      dlqService: c.get(Services.DlqService),
      sseService: c.get(Services.SseService),
      sseHub: c.get(Services.SseHub),
      readiness: c.get(Services.Readiness),
      queueBoard: c.get(Services.QueueBoard),
    }));
}
