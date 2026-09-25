import { token } from '@vp/composition';
import type { JobQueue } from '@vp/core/ports';
import type { Logger } from '@vp/logger';
import type { MetricsServer } from '@vp/observability';
import type { Paginator } from '@vp/pagination';
import type { FastifyPluginCallback } from 'fastify';
import type { AnalyticsService } from '../services/analytics-service';
import type { CategoryService } from '../services/category-service';
import type { ChannelService } from '../services/channel-service';
import type { DlqService } from '../services/dlq-service';
import type { FeedService } from '../services/feed-service';
import type { Poller } from '../services/poller';
import type { QueueService } from '../services/queue-service';
import type { ReactionService } from '../services/reaction-service';
import type { ReadinessService } from '../services/readiness-service';
import type { SseHub } from '../services/sse-hub';
import type { SseService } from '../services/sse-service';
import type { SubscriptionService } from '../services/subscription-service';
import type { UploadService } from '../services/upload-service';
import type { VideoService } from '../services/video-service';
import type { ViewService } from '../services/view-service';

export interface ServiceSet {
  videoService: VideoService;
  uploadService: UploadService;
  feedService: FeedService;
  categoryService: CategoryService;
  channelService: ChannelService;
  reactionService: ReactionService;
  subscriptionService: SubscriptionService;
  viewService: ViewService;
  analyticsService: AnalyticsService;
  queueService: QueueService;
  dlqService: DlqService;
  sseService: SseService;
  sseHub: SseHub;
  readiness: ReadinessService;
  queueBoard: FastifyPluginCallback;
}

export const Services = {
  Logger: token<Logger>('Logger'),
  Paginator: token<Paginator>('Paginator'),
  VideoService: token<VideoService>('VideoService'),
  UploadService: token<UploadService>('UploadService'),
  FeedService: token<FeedService>('FeedService'),
  CategoryService: token<CategoryService>('CategoryService'),
  ChannelService: token<ChannelService>('ChannelService'),
  ReactionService: token<ReactionService>('ReactionService'),
  SubscriptionService: token<SubscriptionService>('SubscriptionService'),
  ViewService: token<ViewService>('ViewService'),
  AnalyticsService: token<AnalyticsService>('AnalyticsService'),
  QueueService: token<QueueService>('QueueService'),
  DlqService: token<DlqService>('DlqService'),
  SseService: token<SseService>('SseService'),
  SseHub: token<SseHub>('SseHub'),
  Readiness: token<ReadinessService>('Readiness'),
  QueuePoller: token<Poller>('QueuePoller'),
  SqlPoller: token<Poller>('SqlPoller'),
  HousekeepingQueue: token<JobQueue>('HousekeepingQueue'),
  QueueBoard: token<FastifyPluginCallback>('QueueBoard'),
  MetricsServer: token<MetricsServer>('MetricsServer'),
  ServiceSet: token<ServiceSet>('ServiceSet'),
} as const;
