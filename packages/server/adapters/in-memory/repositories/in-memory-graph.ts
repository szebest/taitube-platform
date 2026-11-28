import { Container } from '@kit/composition';
import { type Clock, realClock } from './clock';
import { InMemoryCaptionRepository } from './in-memory-caption-repository';
import { InMemoryCategoryRepository } from './in-memory-category-repository';
import { provideChannels } from './in-memory-channel-providers';
import { InMemoryClipRepository } from './in-memory-clip-repository';
import { provideCommentRepositories } from './in-memory-comment-graph';
import { InMemoryDlqRepository } from './in-memory-dlq-repository';
import { InMemoryEventRepository } from './in-memory-event-repository';
import { provideExports } from './in-memory-export-providers';
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
import { provideScreening } from './in-memory-screening-providers';
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
import { provideVideoTools } from './in-memory-video-tools-providers';
import { InMemoryVideoViewRepository } from './in-memory-video-view-repository';
import { InMemoryWatchHistoryRepository } from './in-memory-watch-history-repository';
import { InMemoryWebhookRepository } from './in-memory-webhook-repository';

/**
 * Videos and uploads each need the other. The back-edge is a delegate that resolves on first call,
 * after both are built, so no repository needs a setter to be wired.
 */
export function graph(now: Clock = realClock): Container {
  return provideCommentRepositories(
    provideChannels(
      provideExports(provideScreening(provideVideoTools(new Container(), now)), now),
      now
    )
      .provide(Repo.outbox, () => new InMemoryOutboxRepository(now))
      .provide(Repo.renditions, () => new InMemoryRenditionRepository())
      .provide(Repo.steps, () => new InMemoryStepRepository(now))
      .provide(Repo.users, () => new InMemoryUserRepository())
      .provide(Repo.userEvents, (c) => new InMemoryUserEventRepository(c.get(Repo.outbox), now))
      .provide(Repo.events, () => new InMemoryEventRepository())
      .provide(Repo.savedReplies, () => new InMemorySavedReplyRepository())
      .provide(
        Repo.videos,
        (c) =>
          new InMemoryVideoRepository({
            eventsRepo: c.get(Repo.events),
            renditionsRepo: c.get(Repo.renditions),
            stepsRepo: c.get(Repo.steps),
            outboxRepo: c.get(Repo.outbox),
            userEventsRepo: c.get(Repo.userEvents),
            auditRepo: c.get(Repo.channelAudit),
            now,
            uploadsRepo: { findByVideoId: (id) => c.get(Repo.uploads).findByVideoId(id) },
            liveStreamsRepo: {
              findByVideoId: (id) => c.get(Repo.liveStreams).findByVideoId(id),
            },
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
            auditRepo: c.get(Repo.channelAudit),
          })
      )
      .provide(
        Repo.videoViews,
        (c) =>
          new InMemoryVideoViewRepository(c.get(Repo.videos), {
            shareLinks: c.get(Repo.shareLinks),
            experiments: c.get(Repo.videoExperiments),
          })
      )
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
        (c) => new InMemoryNotificationRepository(c.get(Repo.userEvents), now)
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
            now,
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
        Repo.picks,
        (c) =>
          new InMemoryPickRepository({
            videosRepo: c.get(Repo.videos),
            channelsRepo: c.get(Repo.channels),
          })
      )
  );
}
