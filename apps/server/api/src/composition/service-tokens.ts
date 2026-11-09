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
  ChannelFeaturedService,
  ChannelImageService,
  ChannelService,
  ClipService,
  OEmbedService,
  WebhookService,
  CommentReportService,
  CommentService,
  CreatorCommentService,
  CreatorLiveService,
  CreatorStudioService,
  CurrentPickService,
  DiscoveryShelves,
  DlqService,
  FeedService,
  HomeService,
  LiveChatHub,
  LiveChatService,
  LiveCompanionService,
  LiveIngestService,
  LiveService,
  LiveViewerTracker,
  NotificationService,
  PickService,
  PlaybackTelemetryService,
  PlaylistService,
  PreferencesService,
  QueueService,
  ReactionService,
  RecommendationFeedbackService,
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
import type { PatternHub } from '../services/pattern-hub';
import type { Poller } from '../services/poller';
import type { ReadinessService } from '../services/readiness-service';
import type { ViewerProgress } from '../services/viewer-progress';
import type {
  BufferingWait,
  OwnerGrace,
  Reaction,
  RoomBatcher,
  RoomEnvelope,
  RosterChange,
  WatchPartyBroadcaster,
  WatchPartyContextLoader,
  WatchPartySocketService,
  WatchPartyService,
  WatchPartyGuestService,
  WatchPartyRoleService,
  WatchPartyMemberService,
  WatchPartyQueueService,
  WatchPartyInviteService,
  WatchPartyControlsService,
} from '../services/watch-party/index';

export interface ServiceSet {
  videoService: VideoService;
  creatorStudioService: CreatorStudioService;
  searchService: SearchService;
  searchHistoryService: SearchHistoryService;
  uploadService: UploadService;
  feedService: FeedService;
  homeService: HomeService;
  relatedService: RelatedService;
  recommendationFeedbackService: RecommendationFeedbackService;
  categoryService: CategoryService;
  channelService: ChannelService;
  channelImageService: ChannelImageService;
  channelFeaturedService: ChannelFeaturedService;
  clipService: ClipService;
  oembedService: OEmbedService;
  webhookService: WebhookService;
  liveIngestService: LiveIngestService;
  creatorLiveService: CreatorLiveService;
  liveService: LiveService;
  liveChatService: LiveChatService;
  liveCompanionService: LiveCompanionService;
  liveViewerTracker: LiveViewerTracker;
  currentPickService: CurrentPickService;
  pickService: PickService;
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
  watchPartyService: WatchPartyService;
  watchPartyGuestService: WatchPartyGuestService;
  watchPartyRoleService: WatchPartyRoleService;
  watchPartyMemberService: WatchPartyMemberService;
  watchPartyQueueService: WatchPartyQueueService;
  watchPartyInviteService: WatchPartyInviteService;
  watchPartyControlsService: WatchPartyControlsService;
  watchPartySocketService: WatchPartySocketService;
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
  DiscoveryShelves: token<DiscoveryShelves>('DiscoveryShelves'),
  RelatedService: token<RelatedService>('RelatedService'),
  RecommendationFeedbackService: token<RecommendationFeedbackService>(
    'RecommendationFeedbackService'
  ),
  CategoryService: token<CategoryService>('CategoryService'),
  ChannelService: token<ChannelService>('ChannelService'),
  ChannelImageService: token<ChannelImageService>('ChannelImageService'),
  ChannelFeaturedService: token<ChannelFeaturedService>('ChannelFeaturedService'),
  ClipService: token<ClipService>('ClipService'),
  OEmbedService: token<OEmbedService>('OEmbedService'),
  WebhookService: token<WebhookService>('WebhookService'),
  LiveIngestService: token<LiveIngestService>('LiveIngestService'),
  CreatorLiveService: token<CreatorLiveService>('CreatorLiveService'),
  LiveService: token<LiveService>('LiveService'),
  LiveChatService: token<LiveChatService>('LiveChatService'),
  LiveChatHub: token<LiveChatHub>('LiveChatHub'),
  LiveCompanionService: token<LiveCompanionService>('LiveCompanionService'),
  LiveViewerTracker: token<LiveViewerTracker>('LiveViewerTracker'),
  LiveViewerHeartbeat: token<Poller>('LiveViewerHeartbeat'),
  CurrentPickService: token<CurrentPickService>('CurrentPickService'),
  PickService: token<PickService>('PickService'),
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
  WatchPartyBroadcaster: token<WatchPartyBroadcaster>('WatchPartyBroadcaster'),
  WatchPartyContextLoader: token<WatchPartyContextLoader>('WatchPartyContextLoader'),
  WatchPartyService: token<WatchPartyService>('WatchPartyService'),
  WatchPartyGuestService: token<WatchPartyGuestService>('WatchPartyGuestService'),
  WatchPartyRoleService: token<WatchPartyRoleService>('WatchPartyRoleService'),
  WatchPartyMemberService: token<WatchPartyMemberService>('WatchPartyMemberService'),
  WatchPartyQueueService: token<WatchPartyQueueService>('WatchPartyQueueService'),
  WatchPartyInviteService: token<WatchPartyInviteService>('WatchPartyInviteService'),
  WatchPartyControlsService: token<WatchPartyControlsService>('WatchPartyControlsService'),
  WatchPartyHub: token<PatternHub<RoomEnvelope>>('WatchPartyHub'),
  WatchPartyReactions: token<RoomBatcher<Reaction>>('WatchPartyReactions'),
  WatchPartyRoster: token<RoomBatcher<RosterChange>>('WatchPartyRoster'),
  WatchPartyBuffering: token<BufferingWait>('WatchPartyBuffering'),
  WatchPartyOwnerGrace: token<OwnerGrace>('WatchPartyOwnerGrace'),
  WatchPartySocketService: token<WatchPartySocketService>('WatchPartySocketService'),
} as const;
