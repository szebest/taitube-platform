import { Container } from '@vp/composition';
import { InMemoryCaptionRepository } from './in-memory-caption-repository';
import { InMemoryCategoryRepository } from './in-memory-category-repository';
import { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import { InMemoryChannelFeaturedRepository } from './in-memory-channel-featured-repository';
import { InMemoryChannelHandleHistoryRepository } from './in-memory-channel-handle-history-repository';
import { InMemoryChannelImageRepository } from './in-memory-channel-image-repository';
import { InMemoryChannelInviteRepository } from './in-memory-channel-invite-repository';
import { InMemoryChannelMemberRepository } from './in-memory-channel-member-repository';
import { InMemoryChannelPageRepository } from './in-memory-channel-page-repository';
import { InMemoryChannelRepository } from './in-memory-channel-repository';
import { InMemoryClipRepository } from './in-memory-clip-repository';
import { provideCommentRepositories } from './in-memory-comment-graph';
import { InMemoryDlqRepository } from './in-memory-dlq-repository';
import { InMemoryEventRepository } from './in-memory-event-repository';
import { InMemoryLiveStreamRepository } from './in-memory-live-stream-repository';
import { InMemoryNotificationRepository } from './in-memory-notification-repository';
import { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import { InMemoryPickRepository } from './in-memory-pick-repository';
import { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import { InMemoryRecommendationFeedbackRepository } from './in-memory-recommendation-feedback-repository';
import { InMemoryRelatedVideosRepository } from './in-memory-related-videos-repository';
import { InMemoryRenditionRepository } from './in-memory-rendition-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryRisingVideosRepository } from './in-memory-rising-videos-repository';
import { InMemorySavedReplyRepository } from './in-memory-saved-reply-repository';
import { InMemorySearchHistoryRepository } from './in-memory-search-history-repository';
import { InMemorySearchRepository } from './in-memory-search-repository';
import { InMemoryStepRepository } from './in-memory-step-repository';
import { InMemorySubscriptionRepository } from './in-memory-subscription-repository';
import { InMemoryUploadRepository } from './in-memory-upload-repository';
import { InMemoryUserEventRepository } from './in-memory-user-event-repository';
import { InMemoryUserPreferencesRepository } from './in-memory-user-preferences-repository';
import { InMemoryUserRepository } from './in-memory-user-repository';
import { InMemoryVideoReactionRepository } from './in-memory-video-reaction-repository';
import { InMemoryVideoRepository } from './in-memory-video-repository';
import { InMemoryVideoStudioRepository } from './in-memory-video-studio-repository';
import { InMemoryVideoViewRepository } from './in-memory-video-view-repository';
import { InMemoryWatchHistoryRepository } from './in-memory-watch-history-repository';
import { InMemoryWebhookRepository } from './in-memory-webhook-repository';

/**
 * Videos and uploads each need the other. The back-edge is a delegate that resolves on first call,
 * after both are built, so no repository needs a setter to be wired.
 */
export function graph(): Container {
  return provideCommentRepositories(
    new Container()
      .provide(Repo.outbox, () => new InMemoryOutboxRepository())
      .provide(Repo.renditions, () => new InMemoryRenditionRepository())
      .provide(Repo.steps, () => new InMemoryStepRepository())
      .provide(Repo.users, () => new InMemoryUserRepository())
      .provide(Repo.userEvents, (c) => new InMemoryUserEventRepository(c.get(Repo.outbox)))
      .provide(Repo.channelHandleHistory, () => new InMemoryChannelHandleHistoryRepository())
      .provide(
        Repo.channels,
        (c) => new InMemoryChannelRepository(c.get(Repo.videos), c.get(Repo.channelHandleHistory))
      )
      .provide(Repo.events, () => new InMemoryEventRepository())
      .provide(Repo.channelAudit, () => new InMemoryChannelAuditRepository())
      .provide(Repo.savedReplies, () => new InMemorySavedReplyRepository())
      .provide(
        Repo.channelMembers,
        (c) =>
          new InMemoryChannelMemberRepository({
            channels: c.get(Repo.channels),
            audit: c.get(Repo.channelAudit),
            invites: { revokeSentBy: (sent) => c.get(Repo.channelInvites).revokeSentBy(sent) },
          })
      )
      .provide(
        Repo.channelInvites,
        (c) =>
          new InMemoryChannelInviteRepository({
            members: c.get(Repo.channelMembers),
            channels: c.get(Repo.channels),
            audit: c.get(Repo.channelAudit),
            outbox: c.get(Repo.outbox),
          })
      )
      .provide(
        Repo.videos,
        (c) =>
          new InMemoryVideoRepository({
            eventsRepo: c.get(Repo.events),
            renditionsRepo: c.get(Repo.renditions),
            stepsRepo: c.get(Repo.steps),
            outboxRepo: c.get(Repo.outbox),
            userEventsRepo: c.get(Repo.userEvents),
            uploadsRepo: { findByVideoId: (id) => c.get(Repo.uploads).findByVideoId(id) },
          })
      )
      .provide(
        Repo.videoStudio,
        (c) =>
          new InMemoryVideoStudioRepository({
            videos: c.get(Repo.videos),
            categories: c.get(Repo.categories),
            events: c.get(Repo.events),
            outbox: c.get(Repo.outbox),
            channels: c.get(Repo.channels),
            audit: c.get(Repo.channelAudit),
          })
      )
      .provide(
        Repo.uploads,
        (c) => new InMemoryUploadRepository({ videosRepo: c.get(Repo.videos) })
      )
      .provide(Repo.dlq, (c) => new InMemoryDlqRepository({ outboxRepo: c.get(Repo.outbox) }))
      .provide(
        Repo.categories,
        (c) => new InMemoryCategoryRepository({ videosRepo: c.get(Repo.videos) })
      )
      .provide(
        Repo.videoReactions,
        (c) =>
          new InMemoryVideoReactionRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
          })
      )
      .provide(
        Repo.subscriptions,
        (c) =>
          new InMemorySubscriptionRepository({
            channelsRepo: c.get(Repo.channels),
            videosRepo: c.get(Repo.videos),
          })
      )
      .provide(Repo.videoViews, (c) => new InMemoryVideoViewRepository(c.get(Repo.videos)))
      .provide(
        Repo.playlists,
        (c) =>
          new InMemoryPlaylistRepository({
            channelsRepo: c.get(Repo.channels),
            videosRepo: c.get(Repo.videos),
          })
      )
      .provide(
        Repo.watchHistory,
        (c) =>
          new InMemoryWatchHistoryRepository({
            channelsRepo: c.get(Repo.channels),
            videosRepo: c.get(Repo.videos),
          })
      )
      .provide(
        Repo.userPreferences,
        (c) => new InMemoryUserPreferencesRepository(c.get(Repo.userEvents))
      )
      .provide(
        Repo.notifications,
        (c) => new InMemoryNotificationRepository(c.get(Repo.userEvents))
      )
      .provide(
        Repo.search,
        (c) =>
          new InMemorySearchRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
            playlistsRepo: c.get(Repo.playlists),
          })
      )
      .provide(Repo.searchHistory, () => new InMemorySearchHistoryRepository())
      .provide(Repo.webhooks, () => new InMemoryWebhookRepository())
      .provide(
        Repo.liveStreams,
        (c) =>
          new InMemoryLiveStreamRepository({
            videos: c.get(Repo.videos),
            events: c.get(Repo.events),
            outbox: c.get(Repo.outbox),
            userEvents: c.get(Repo.userEvents),
          })
      )
      .provide(
        Repo.recommendationFeedback,
        (c) =>
          new InMemoryRecommendationFeedbackRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
          })
      )
      .provide(
        Repo.related,
        (c) =>
          new InMemoryRelatedVideosRepository({
            videosRepo: c.get(Repo.videos),
            historyRepo: c.get(Repo.watchHistory),
          })
      )
      .provide(
        Repo.rising,
        (c) =>
          new InMemoryRisingVideosRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
            viewsRepo: c.get(Repo.videoViews),
          })
      )
      .provide(
        Repo.captions,
        (c) =>
          new InMemoryCaptionRepository({
            videos: c.get(Repo.videos),
            channels: c.get(Repo.channels),
            events: c.get(Repo.events),
            userEvents: c.get(Repo.userEvents),
          })
      )
      .provide(
        Repo.clips,
        (c) =>
          new InMemoryClipRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
          })
      )
      .provide(
        Repo.channelFeatured,
        (c) => new InMemoryChannelFeaturedRepository(c.get(Repo.videos))
      )
      .provide(Repo.channelPages, (c) => new InMemoryChannelPageRepository(c.get(Repo.videos)))
      .provide(
        Repo.channelImages,
        (c) =>
          new InMemoryChannelImageRepository({
            channels: c.get(Repo.channels),
            audit: c.get(Repo.channelAudit),
            userEvents: c.get(Repo.userEvents),
          })
      )
      .provide(
        Repo.picks,
        (c) =>
          new InMemoryPickRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
          })
      )
  );
}
