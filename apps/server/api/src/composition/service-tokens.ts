import { token } from '@vp/composition';
import type { JobQueue } from '@vp/core/ports';
import type { Logger } from '@vp/logger';
import type { MetricsServer } from '@vp/observability';
import type { Paginator } from '@vp/pagination';
import type { FastifyPluginCallback } from 'fastify';
import type { HistoryPause } from '../services/history-pause';
import type {
  AnalyticsService,
  BootstrapService,
  CaptionService,
  CaptionTrackService,
  CategoryService,
  ChannelService,
  ClipService,
  CommentReportService,
  CommentService,
  CreatorCommentService,
  CreatorStudioService,
  DlqService,
  FeedService,
  HomeService,
  NotificationService,
  PlaybackTelemetryService,
  PlaylistService,
  PreferencesService,
  QueueService,
  ReactionService,
  RelatedService,
  SearchHistoryService,
  SearchService,
  SseHub,
  SseService,
  SubscriptionService,
  UploadService,
  VideoService,
  ViewerActivityService,
  ViewService,
  WatchHistoryService,
  WebVitalsService,
} from '../services/index';
import type { Poller } from '../services/poller';
import type { ReadinessService } from '../services/readiness-service';
import type { ViewerProgress } from '../services/viewer-progress';

export interface ServiceSet {
  videoService: VideoService;
  creatorStudioService: CreatorStudioService;
  searchService: SearchService;
  searchHistoryService: SearchHistoryService;
  uploadService: UploadService;
  feedService: FeedService;
  homeService: HomeService;
  relatedService: RelatedService;
  categoryService: CategoryService;
  channelService: ChannelService;
  clipService: ClipService;
  reactionService: ReactionService;
  subscriptionService: SubscriptionService;
  commentService: CommentService;
  commentReportService: CommentReportService;
  creatorCommentService: CreatorCommentService;
  viewService: ViewService;
  webVitalsService: WebVitalsService;
  playbackTelemetryService: PlaybackTelemetryService;
  analyticsService: AnalyticsService;
  bootstrapService: BootstrapService;
  playlistService: PlaylistService;
  watchHistoryService: WatchHistoryService;
  viewerActivityService: ViewerActivityService;
  preferencesService: PreferencesService;
  captionService: CaptionService;
  captionTrackService: CaptionTrackService;
  notificationService: NotificationService;
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
  ViewerProgress: token<ViewerProgress>('ViewerProgress'),
  HistoryPause: token<HistoryPause>('HistoryPause'),
  VideoService: token<VideoService>('VideoService'),
  CreatorStudioService: token<CreatorStudioService>('CreatorStudioService'),
  SearchService: token<SearchService>('SearchService'),
  SearchHistoryService: token<SearchHistoryService>('SearchHistoryService'),
  UploadService: token<UploadService>('UploadService'),
  FeedService: token<FeedService>('FeedService'),
  HomeService: token<HomeService>('HomeService'),
  RelatedService: token<RelatedService>('RelatedService'),
  CategoryService: token<CategoryService>('CategoryService'),
  ChannelService: token<ChannelService>('ChannelService'),
  ClipService: token<ClipService>('ClipService'),
  ReactionService: token<ReactionService>('ReactionService'),
  SubscriptionService: token<SubscriptionService>('SubscriptionService'),
  CommentService: token<CommentService>('CommentService'),
  CommentReportService: token<CommentReportService>('CommentReportService'),
  CreatorCommentService: token<CreatorCommentService>('CreatorCommentService'),
  ViewService: token<ViewService>('ViewService'),
  WebVitalsService: token<WebVitalsService>('WebVitalsService'),
  PlaybackTelemetryService: token<PlaybackTelemetryService>('PlaybackTelemetryService'),
  AnalyticsService: token<AnalyticsService>('AnalyticsService'),
  BootstrapService: token<BootstrapService>('BootstrapService'),
  PlaylistService: token<PlaylistService>('PlaylistService'),
  WatchHistoryService: token<WatchHistoryService>('WatchHistoryService'),
  ViewerActivityService: token<ViewerActivityService>('ViewerActivityService'),
  PreferencesService: token<PreferencesService>('PreferencesService'),
  CaptionService: token<CaptionService>('CaptionService'),
  CaptionTrackService: token<CaptionTrackService>('CaptionTrackService'),
  NotificationService: token<NotificationService>('NotificationService'),
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
