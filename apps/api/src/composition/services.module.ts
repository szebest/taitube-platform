import { Adapters, queueNamed } from '@vp/adapters/composition';
import { type Container, token } from '@vp/composition';
import type { JobQueue } from '@vp/core/ports';
import { getMetrics } from '@vp/observability';
import { Paginator } from '@vp/pagination';
import { CategoryService } from '../services/category-service';
import { ChannelService } from '../services/channel-service';
import { DlqService } from '../services/dlq-service';
import { FeedService } from '../services/feed-service';
import { registerHousekeepingSchedulers } from '../services/housekeeping-schedulers';
import { Poller } from '../services/poller';
import { QUEUE_POLL_INTERVAL_MS, pollQueueMetrics } from '../services/queue-poller';
import { QueueService } from '../services/queue-service';
import { ReactionService } from '../services/reaction-service';
import { ReadinessService } from '../services/readiness-service';
import { SQL_POLL_INTERVAL_MS, pollSqlMetrics } from '../services/sql-poller';
import { SseHub } from '../services/sse-hub';
import { SseService } from '../services/sse-service';
import { SubscriptionService } from '../services/subscription-service';
import { UploadService } from '../services/upload-service';
import { VideoService } from '../services/video-service';

export interface ServiceSet {
  videoService: VideoService;
  uploadService: UploadService;
  feedService: FeedService;
  categoryService: CategoryService;
  channelService: ChannelService;
  reactionService: ReactionService;
  subscriptionService: SubscriptionService;
  queueService: QueueService;
  dlqService: DlqService;
  sseService: SseService;
  sseHub: SseHub;
  readiness: ReadinessService;
}

export const Services = {
  Paginator: token<Paginator>('Paginator'),
  VideoService: token<VideoService>('VideoService'),
  UploadService: token<UploadService>('UploadService'),
  FeedService: token<FeedService>('FeedService'),
  CategoryService: token<CategoryService>('CategoryService'),
  ChannelService: token<ChannelService>('ChannelService'),
  ReactionService: token<ReactionService>('ReactionService'),
  SubscriptionService: token<SubscriptionService>('SubscriptionService'),
  QueueService: token<QueueService>('QueueService'),
  DlqService: token<DlqService>('DlqService'),
  SseService: token<SseService>('SseService'),
  SseHub: token<SseHub>('SseHub'),
  Readiness: token<ReadinessService>('Readiness'),
  QueuePoller: token<Poller>('QueuePoller'),
  SqlPoller: token<Poller>('SqlPoller'),
  HousekeepingQueue: token<JobQueue>('HousekeepingQueue'),
  ServiceSet: token<ServiceSet>('ServiceSet'),
} as const;

/** Resolving them is what makes `start()` run them; nothing here opens a socket or a timer. */
export function resolveBackground(c: Container): void {
  c.get(Services.SseHub);
  c.get(Services.QueuePoller);
  c.get(Services.SqlPoller);
  c.get(Services.HousekeepingQueue);
}

export function registerServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);

  return c
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
        })
    )
    .provide(
      Services.CategoryService,
      (c) =>
        new CategoryService({
          categories: repositories().categories,
          categoryCache: c.get(Adapters.CategoryCache),
        })
    )
    .provide(
      Services.ChannelService,
      () => new ChannelService({ users: repositories().users, channels: repositories().channels })
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
      Services.QueueService,
      (c) =>
        new QueueService({
          queues: c.get(Adapters.Queues),
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
        return new Poller(() => pollQueueMetrics(queues, getMetrics()), QUEUE_POLL_INTERVAL_MS);
      },
      { start: (poller) => poller.start(), dispose: (poller) => poller.stop() }
    )
    .provide(
      Services.SqlPoller,
      () => new Poller(() => pollSqlMetrics(repositories(), getMetrics()), SQL_POLL_INTERVAL_MS),
      { start: (poller) => poller.start(), dispose: (poller) => poller.stop() }
    )
    .provide(
      Services.HousekeepingQueue,
      (c) => queueNamed(c.get(Adapters.Queues), 'housekeeping'),
      { start: (queue) => registerHousekeepingSchedulers(queue) }
    )
    .provide(Services.ServiceSet, (c) => ({
      videoService: c.get(Services.VideoService),
      uploadService: c.get(Services.UploadService),
      feedService: c.get(Services.FeedService),
      categoryService: c.get(Services.CategoryService),
      channelService: c.get(Services.ChannelService),
      reactionService: c.get(Services.ReactionService),
      subscriptionService: c.get(Services.SubscriptionService),
      queueService: c.get(Services.QueueService),
      dlqService: c.get(Services.DlqService),
      sseService: c.get(Services.SseService),
      sseHub: c.get(Services.SseHub),
      readiness: c.get(Services.Readiness),
    }));
}
