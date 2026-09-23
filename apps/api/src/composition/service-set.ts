import { CoreEnvSchema } from '@vp/env-schema';
import { Paginator } from '@vp/pagination';
import { CategoryService } from '../services/category-service';
import { ChannelService } from '../services/channel-service';
import { DlqService } from '../services/dlq-service';
import { FeedService } from '../services/feed-service';
import { HttpCacheService } from '../services/http-cache-service';
import { QueueService } from '../services/queue-service';
import { ReactionService } from '../services/reaction-service';
import { SseHub } from '../services/sse-hub';
import { SseService } from '../services/sse-service';
import { SubscriptionService } from '../services/subscription-service';
import { UploadService } from '../services/upload-service';
import { VideoService } from '../services/video-service';
import type { AdapterSet } from './adapter-set';

export interface AppLimits {
  rateLimitMax?: number;
  maxUploadBytes?: number;
  multipartThresholdBytes?: number;
  maxInflightPerUser?: number;
  sseMaxPerUser?: number;
  sseHeartbeatMs?: number;
  sseIdleTimeoutMs?: number;
}

export interface ServiceSetConfig {
  cdnBaseUrl: string;
  rawBucket: string;
  limits: AppLimits;
}

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
}

function envPaginator(): Paginator {
  const { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } = CoreEnvSchema.pick({
    PAGE_SIZE_DEFAULT: true,
    PAGE_SIZE_MAX: true,
  }).parse(process.env);

  return new Paginator({ defaultLimit: PAGE_SIZE_DEFAULT, maxLimit: PAGE_SIZE_MAX });
}

export async function createServiceSet(
  adapters: AdapterSet,
  config: ServiceSetConfig
): Promise<ServiceSet> {
  const { repositories, cache, authorization } = adapters;
  const { cdnBaseUrl, limits } = config;
  const paginator = envPaginator();
  const httpCacheService = new HttpCacheService();

  const videoService = new VideoService({
    videos: repositories.videos,
    cdnBaseUrl,
    reactionCache: adapters.reactionCache,
    authorization,
    paginator,
    ...(adapters.probeQueue ? { probeQueue: adapters.probeQueue } : {}),
  });

  const sseHub = new SseHub({
    cache,
    ...(limits.sseMaxPerUser === undefined ? {} : { maxConnectionsPerUser: limits.sseMaxPerUser }),
    ...(limits.sseHeartbeatMs === undefined ? {} : { heartbeatMs: limits.sseHeartbeatMs }),
    ...(limits.sseIdleTimeoutMs === undefined ? {} : { idleTimeoutMs: limits.sseIdleTimeoutMs }),
  });
  await sseHub.init();

  return {
    videoService,
    sseHub,
    uploadService: new UploadService({
      uploads: repositories.uploads,
      videos: repositories.videos,
      events: repositories.events,
      users: repositories.users,
      storage: adapters.storage,
      multipart: adapters.multipart,
      rawBucket: config.rawBucket,
      ...(adapters.probeQueue ? { probeQueue: adapters.probeQueue } : {}),
      ...(limits.multipartThresholdBytes === undefined
        ? {}
        : { multipartThresholdBytes: limits.multipartThresholdBytes }),
      ...(limits.maxInflightPerUser === undefined
        ? {}
        : { maxInflightPerUser: limits.maxInflightPerUser }),
    }),
    feedService: new FeedService({ videoService, cache, httpCacheService }),
    categoryService: new CategoryService({
      categories: repositories.categories,
      categoryCacheService: adapters.categoryCache,
      httpCacheService,
    }),
    channelService: new ChannelService({
      users: repositories.users,
      channels: repositories.channels,
    }),
    reactionService: new ReactionService({
      videoReactions: repositories.videoReactions,
      reactionCache: adapters.reactionCache,
      videos: repositories.videos,
    }),
    subscriptionService: new SubscriptionService({
      subscriptions: repositories.subscriptions,
      channels: repositories.channels,
      subscriptionCache: adapters.subscriptionCache,
      cdnBaseUrl,
      paginator,
    }),
    queueService: new QueueService({ queues: adapters.queues }),
    dlqService: new DlqService({
      dlq: repositories.dlq,
      events: repositories.events,
      queues: adapters.queues,
      paginator,
    }),
    sseService: new SseService({
      videos: repositories.videos,
      renditions: repositories.renditions,
      events: repositories.events,
      cdnBaseUrl,
    }),
  };
}
