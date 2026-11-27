import type { Repositories } from '@vp/core/repositories';
import type { Sql } from 'postgres';
import { PostgresCaptionRepository } from './postgres-caption-repository';
import { PostgresCategoryRepository } from './postgres-category-repository';
import {
  type ChannelRepositories,
  createChannelRepositories,
} from './postgres-channel-repositories';
import { PostgresClipRepository } from './postgres-clip-repository';
import {
  type CommentRepositories,
  createCommentRepositories,
} from './postgres-comment-repositories';
import { connectPostgres, type PostgresRepositoriesConfig } from './postgres-connection';
import {
  type CreatorDataRepositories,
  createCreatorDataRepositories,
} from './postgres-creator-data-repositories';
import { PostgresDlqRepository } from './postgres-dlq-repository';
import { PostgresEventRepository } from './postgres-event-repository';
import { PostgresFingerprintRepository } from './postgres-fingerprint-repository';
import { PostgresLiveChatRepository } from './postgres-live-chat-repository';
import { PostgresLiveStreamRepository } from './postgres-live-stream-repository';
import { PostgresNotificationRepository } from './postgres-notification-repository';
import { PostgresOutboxRepository } from './postgres-outbox-repository';
import { PostgresPickRepository } from './postgres-pick-repository';
import {
  type PlaylistRepositories,
  createPlaylistRepositories,
} from './postgres-playlist-repositories';
import { PostgresRecommendationFeedbackRepository } from './postgres-recommendation-feedback-repository';
import { PostgresRelatedVideosRepository } from './postgres-related-videos-repository';
import { PostgresRenditionRepository } from './postgres-rendition-repository';
import { PostgresRisingVideosRepository } from './postgres-rising-videos-repository';
import { PostgresScreeningRepository } from './postgres-screening-repository';
import { PostgresSearchHistoryRepository } from './postgres-search-history-repository';
import { PostgresSearchRepository } from './postgres-search-repository';
import { PostgresStepRepository } from './postgres-step-repository';
import { PostgresSubscriptionRepository } from './postgres-subscription-repository';
import { PostgresUploadRepository } from './postgres-upload-repository';
import { PostgresUserEventRepository } from './postgres-user-event-repository';
import { PostgresUserPreferencesRepository } from './postgres-user-preferences-repository';
import { PostgresUserRepository } from './postgres-user-repository';
import { PostgresVideoReactionRepository } from './postgres-video-reaction-repository';
import { PostgresVideoRepository } from './postgres-video-repository';
import { PostgresVideoStudioRepository } from './postgres-video-studio-repository';
import { PostgresVideoToolsRepositories } from './postgres-video-tools-repositories';
import { PostgresVideoViewRepository } from './postgres-video-view-repository';
import { PostgresWatchHistoryRepository } from './postgres-watch-history-repository';
import {
  createWatchPartyRepositories,
  type WatchPartyRepositories,
} from './postgres-watch-party-repositories';
import { PostgresWebhookRepository } from './postgres-webhook-repository';

export class PostgresRepositories extends PostgresVideoToolsRepositories implements Repositories {
  readonly videos: PostgresVideoRepository;
  readonly videoStudio: PostgresVideoStudioRepository;
  readonly uploads: PostgresUploadRepository;
  readonly steps: PostgresStepRepository;
  readonly renditions: PostgresRenditionRepository;
  readonly events: PostgresEventRepository;
  readonly users: PostgresUserRepository;
  readonly userEvents: PostgresUserEventRepository;
  readonly dlq: PostgresDlqRepository;
  readonly outbox: PostgresOutboxRepository;
  readonly categories: PostgresCategoryRepository;
  declare readonly channels: ChannelRepositories['channels'];
  declare readonly channelMembers: ChannelRepositories['channelMembers'];
  declare readonly channelInvites: ChannelRepositories['channelInvites'];
  declare readonly channelAudit: ChannelRepositories['channelAudit'];
  declare readonly channelFeatured: ChannelRepositories['channelFeatured'];
  declare readonly channelHandleHistory: ChannelRepositories['channelHandleHistory'];
  declare readonly channelImages: ChannelRepositories['channelImages'];
  declare readonly channelPages: ChannelRepositories['channelPages'];
  declare readonly channelPosts: ChannelRepositories['channelPosts'];
  declare readonly postEngagement: ChannelRepositories['postEngagement'];
  declare readonly videoThreads: ChannelRepositories['videoThreads'];
  declare readonly dataExports: CreatorDataRepositories['dataExports'];
  declare readonly exportRows: CreatorDataRepositories['exportRows'];
  declare readonly apiTokens: CreatorDataRepositories['apiTokens'];
  declare readonly accountAudit: CreatorDataRepositories['accountAudit'];
  declare readonly commentSettings: CommentRepositories['commentSettings'];
  declare readonly channelUserRestrictions: CommentRepositories['channelUserRestrictions'];
  declare readonly trustedCommenters: CommentRepositories['trustedCommenters'];
  declare readonly savedReplies: CommentRepositories['savedReplies'];
  readonly videoReactions: PostgresVideoReactionRepository;
  readonly subscriptions: PostgresSubscriptionRepository;
  readonly videoViews: PostgresVideoViewRepository;
  declare readonly comments: CommentRepositories['comments'];
  declare readonly commentModeration: CommentRepositories['commentModeration'];
  declare readonly commentReports: CommentRepositories['commentReports'];
  declare readonly playlists: PlaylistRepositories['playlists'];
  declare readonly playlistCollaborators: PlaylistRepositories['playlistCollaborators'];
  declare readonly playlistActivity: PlaylistRepositories['playlistActivity'];
  declare readonly smartPlaylists: PlaylistRepositories['smartPlaylists'];
  declare readonly playlistLibrary: PlaylistRepositories['playlistLibrary'];
  declare readonly playlistStats: PlaylistRepositories['playlistStats'];
  readonly watchHistory: PostgresWatchHistoryRepository;
  readonly userPreferences: PostgresUserPreferencesRepository;
  readonly notifications: PostgresNotificationRepository;
  readonly search: PostgresSearchRepository;
  readonly searchHistory: PostgresSearchHistoryRepository;
  readonly recommendationFeedback: PostgresRecommendationFeedbackRepository;
  readonly related: PostgresRelatedVideosRepository;
  readonly rising: PostgresRisingVideosRepository;
  readonly captions: PostgresCaptionRepository;
  readonly screenings: PostgresScreeningRepository;
  readonly fingerprints: PostgresFingerprintRepository;
  readonly clips: PostgresClipRepository;
  readonly picks: PostgresPickRepository;
  readonly webhooks: PostgresWebhookRepository;
  readonly liveStreams: PostgresLiveStreamRepository;
  readonly liveChat: PostgresLiveChatRepository;
  declare readonly watchPartyRooms: WatchPartyRepositories['watchPartyRooms'];
  declare readonly watchPartyRoles: WatchPartyRepositories['watchPartyRoles'];
  declare readonly watchPartyMembers: WatchPartyRepositories['watchPartyMembers'];
  declare readonly watchPartyQueue: WatchPartyRepositories['watchPartyQueue'];
  declare readonly watchPartyMessages: WatchPartyRepositories['watchPartyMessages'];
  declare readonly watchPartyInvites: WatchPartyRepositories['watchPartyInvites'];
  declare readonly watchPartyInviteLinks: WatchPartyRepositories['watchPartyInviteLinks'];
  declare readonly watchPartyControls: WatchPartyRepositories['watchPartyControls'];
  declare readonly watchPartyHousekeeping: WatchPartyRepositories['watchPartyHousekeeping'];

  private readonly ownedPool: Sql | undefined;

  constructor(config: PostgresRepositoriesConfig) {
    const { db, ownedPool } = connectPostgres(config);
    super(db);
    this.ownedPool = ownedPool;

    this.videos = new PostgresVideoRepository(db);
    this.videoStudio = new PostgresVideoStudioRepository(db);
    this.uploads = new PostgresUploadRepository(db);
    this.steps = new PostgresStepRepository(db);
    this.renditions = new PostgresRenditionRepository(db);
    this.events = new PostgresEventRepository(db);
    this.users = new PostgresUserRepository(db);
    this.userEvents = new PostgresUserEventRepository(db);
    this.dlq = new PostgresDlqRepository(db);
    this.outbox = new PostgresOutboxRepository(db);
    this.categories = new PostgresCategoryRepository(db);
    Object.assign(this, createChannelRepositories(db));
    Object.assign(this, createCreatorDataRepositories(db));
    Object.assign(this, createCommentRepositories(db));
    this.videoReactions = new PostgresVideoReactionRepository(db);
    this.subscriptions = new PostgresSubscriptionRepository(db);
    this.videoViews = new PostgresVideoViewRepository(db);
    Object.assign(this, createPlaylistRepositories(db));
    this.watchHistory = new PostgresWatchHistoryRepository(db);
    this.userPreferences = new PostgresUserPreferencesRepository(db);
    this.notifications = new PostgresNotificationRepository(db);
    this.search = new PostgresSearchRepository(db);
    this.searchHistory = new PostgresSearchHistoryRepository(db);
    this.recommendationFeedback = new PostgresRecommendationFeedbackRepository(db);
    this.related = new PostgresRelatedVideosRepository(db);
    this.rising = new PostgresRisingVideosRepository(db);
    this.captions = new PostgresCaptionRepository(db);
    this.screenings = new PostgresScreeningRepository(db);
    this.fingerprints = new PostgresFingerprintRepository(db);
    this.clips = new PostgresClipRepository(db);
    Object.assign(this, createWatchPartyRepositories(db));
    this.picks = new PostgresPickRepository(db);
    this.webhooks = new PostgresWebhookRepository(db);
    this.liveStreams = new PostgresLiveStreamRepository(db);
    this.liveChat = new PostgresLiveChatRepository(db);
  }

  async close(): Promise<void> {
    await this.ownedPool?.end();
  }
}
