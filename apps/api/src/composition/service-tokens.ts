import { token } from '@vp/composition';
import type { JobQueue } from '@vp/core/ports';
import type { Logger } from '@vp/logger';
import type { MetricsServer } from '@vp/observability';
import type { Paginator } from '@vp/pagination';
import type { FastifyPluginCallback } from 'fastify';
import type {
  AnalyticsService,
  BootstrapService,
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
} from '../services/index';
import type { Poller } from '../services/poller';
import type { ReadinessService } from '../services/readiness-service';

export interface ServiceSet {
  videoService: VideoService;
  uploadService: UploadService;
  feedService: FeedService;
  categoryService: CategoryService;
  channelService: ChannelService;
  reactionService: ReactionService;
  subscriptionService: SubscriptionService;
  commentService: CommentService;
  viewService: ViewService;
  analyticsService: AnalyticsService;
  bootstrapService: BootstrapService;
  playlistService: PlaylistService;
  watchHistoryService: WatchHistoryService;
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
  CommentService: token<CommentService>('CommentService'),
  ViewService: token<ViewService>('ViewService'),
  AnalyticsService: token<AnalyticsService>('AnalyticsService'),
  BootstrapService: token<BootstrapService>('BootstrapService'),
  PlaylistService: token<PlaylistService>('PlaylistService'),
  WatchHistoryService: token<WatchHistoryService>('WatchHistoryService'),
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
