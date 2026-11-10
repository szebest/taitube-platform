import { token } from '@vp/composition';
import type { InMemoryCaptionRepository } from './in-memory-caption-repository';
import type { InMemoryCategoryRepository } from './in-memory-category-repository';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelFeaturedRepository } from './in-memory-channel-featured-repository';
import type { InMemoryChannelHandleHistoryRepository } from './in-memory-channel-handle-history-repository';
import type { InMemoryChannelImageRepository } from './in-memory-channel-image-repository';
import type { InMemoryChannelInviteRepository } from './in-memory-channel-invite-repository';
import type { InMemoryChannelMemberRepository } from './in-memory-channel-member-repository';
import type { InMemoryChannelPageRepository } from './in-memory-channel-page-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import type { InMemoryClipRepository } from './in-memory-clip-repository';
import type { InMemoryCommentModerationRepository } from './in-memory-comment-moderation-repository';
import type { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import type { InMemoryCommentRepository } from './in-memory-comment-repository';
import type { InMemoryCommentSettingsRepository } from './in-memory-comment-settings-repository';
import type { InMemoryDlqRepository } from './in-memory-dlq-repository';
import type { InMemoryEventRepository } from './in-memory-event-repository';
import type { InMemoryLiveStreamRepository } from './in-memory-live-stream-repository';
import type { InMemoryNotificationRepository } from './in-memory-notification-repository';
import type { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import type { InMemoryPickRepository } from './in-memory-pick-repository';
import type { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import type { InMemoryRecommendationFeedbackRepository } from './in-memory-recommendation-feedback-repository';
import type { InMemoryRelatedVideosRepository } from './in-memory-related-videos-repository';
import type { InMemoryRenditionRepository } from './in-memory-rendition-repository';
import type { InMemoryRisingVideosRepository } from './in-memory-rising-videos-repository';
import type { InMemorySavedReplyRepository } from './in-memory-saved-reply-repository';
import type { InMemorySearchHistoryRepository } from './in-memory-search-history-repository';
import type { InMemorySearchRepository } from './in-memory-search-repository';
import type { InMemoryStepRepository } from './in-memory-step-repository';
import type { InMemorySubscriptionRepository } from './in-memory-subscription-repository';
import type { InMemoryTrustedCommenterRepository } from './in-memory-trusted-commenter-repository';
import type { InMemoryUploadRepository } from './in-memory-upload-repository';
import type { InMemoryUserEventRepository } from './in-memory-user-event-repository';
import type { InMemoryUserPreferencesRepository } from './in-memory-user-preferences-repository';
import type { InMemoryUserRepository } from './in-memory-user-repository';
import type { InMemoryVideoReactionRepository } from './in-memory-video-reaction-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';
import type { InMemoryVideoStudioRepository } from './in-memory-video-studio-repository';
import type { InMemoryVideoViewRepository } from './in-memory-video-view-repository';
import type { InMemoryWatchHistoryRepository } from './in-memory-watch-history-repository';
import type { InMemoryWebhookRepository } from './in-memory-webhook-repository';

/** One token per repository, named after the key it is held under. */
export const Repo = {
  events: token<InMemoryEventRepository>('events'),
  renditions: token<InMemoryRenditionRepository>('renditions'),
  steps: token<InMemoryStepRepository>('steps'),
  users: token<InMemoryUserRepository>('users'),
  userEvents: token<InMemoryUserEventRepository>('userEvents'),
  videos: token<InMemoryVideoRepository>('videos'),
  videoStudio: token<InMemoryVideoStudioRepository>('videoStudio'),
  uploads: token<InMemoryUploadRepository>('uploads'),
  dlq: token<InMemoryDlqRepository>('dlq'),
  outbox: token<InMemoryOutboxRepository>('outbox'),
  categories: token<InMemoryCategoryRepository>('categories'),
  channels: token<InMemoryChannelRepository>('channels'),
  channelMembers: token<InMemoryChannelMemberRepository>('channelMembers'),
  channelInvites: token<InMemoryChannelInviteRepository>('channelInvites'),
  channelAudit: token<InMemoryChannelAuditRepository>('channelAudit'),
  commentSettings: token<InMemoryCommentSettingsRepository>('commentSettings'),
  channelUserRestrictions:
    token<InMemoryChannelUserRestrictionRepository>('channelUserRestrictions'),
  trustedCommenters: token<InMemoryTrustedCommenterRepository>('trustedCommenters'),
  savedReplies: token<InMemorySavedReplyRepository>('savedReplies'),
  videoReactions: token<InMemoryVideoReactionRepository>('videoReactions'),
  subscriptions: token<InMemorySubscriptionRepository>('subscriptions'),
  videoViews: token<InMemoryVideoViewRepository>('videoViews'),
  comments: token<InMemoryCommentRepository>('comments'),
  commentModeration: token<InMemoryCommentModerationRepository>('commentModeration'),
  commentReports: token<InMemoryCommentReportRepository>('commentReports'),
  playlists: token<InMemoryPlaylistRepository>('playlists'),
  watchHistory: token<InMemoryWatchHistoryRepository>('watchHistory'),
  userPreferences: token<InMemoryUserPreferencesRepository>('userPreferences'),
  notifications: token<InMemoryNotificationRepository>('notifications'),
  search: token<InMemorySearchRepository>('search'),
  searchHistory: token<InMemorySearchHistoryRepository>('searchHistory'),
  recommendationFeedback: token<InMemoryRecommendationFeedbackRepository>('recommendationFeedback'),
  related: token<InMemoryRelatedVideosRepository>('related'),
  rising: token<InMemoryRisingVideosRepository>('rising'),
  captions: token<InMemoryCaptionRepository>('captions'),
  clips: token<InMemoryClipRepository>('clips'),
  channelFeatured: token<InMemoryChannelFeaturedRepository>('channelFeatured'),
  channelHandleHistory: token<InMemoryChannelHandleHistoryRepository>('channelHandleHistory'),
  channelImages: token<InMemoryChannelImageRepository>('channelImages'),
  channelPages: token<InMemoryChannelPageRepository>('channelPages'),
  picks: token<InMemoryPickRepository>('picks'),
  webhooks: token<InMemoryWebhookRepository>('webhooks'),
  liveStreams: token<InMemoryLiveStreamRepository>('liveStreams'),
} as const;
