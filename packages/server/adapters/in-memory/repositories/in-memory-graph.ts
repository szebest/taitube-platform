import { Container, token } from '@vp/composition';
import { InMemoryCaptionRepository } from './in-memory-caption-repository';
import { InMemoryCategoryRepository } from './in-memory-category-repository';
import { InMemoryChannelFeaturedRepository } from './in-memory-channel-featured-repository';
import { InMemoryChannelRepository } from './in-memory-channel-repository';
import { InMemoryClipRepository } from './in-memory-clip-repository';
import { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import { InMemoryCommentRepository } from './in-memory-comment-repository';
import { InMemoryDlqRepository } from './in-memory-dlq-repository';
import { InMemoryEventRepository } from './in-memory-event-repository';
import { InMemoryNotificationRepository } from './in-memory-notification-repository';
import { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import { InMemoryPickRepository } from './in-memory-pick-repository';
import { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import { InMemoryRelatedVideosRepository } from './in-memory-related-videos-repository';
import { InMemoryRenditionRepository } from './in-memory-rendition-repository';
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
  videoReactions: token<InMemoryVideoReactionRepository>('videoReactions'),
  subscriptions: token<InMemorySubscriptionRepository>('subscriptions'),
  videoViews: token<InMemoryVideoViewRepository>('videoViews'),
  comments: token<InMemoryCommentRepository>('comments'),
  commentReports: token<InMemoryCommentReportRepository>('commentReports'),
  playlists: token<InMemoryPlaylistRepository>('playlists'),
  watchHistory: token<InMemoryWatchHistoryRepository>('watchHistory'),
  userPreferences: token<InMemoryUserPreferencesRepository>('userPreferences'),
  notifications: token<InMemoryNotificationRepository>('notifications'),
  search: token<InMemorySearchRepository>('search'),
  searchHistory: token<InMemorySearchHistoryRepository>('searchHistory'),
  related: token<InMemoryRelatedVideosRepository>('related'),
  captions: token<InMemoryCaptionRepository>('captions'),
  clips: token<InMemoryClipRepository>('clips'),
  channelFeatured: token<InMemoryChannelFeaturedRepository>('channelFeatured'),
  picks: token<InMemoryPickRepository>('picks'),
} as const;

/**
 * Videos and uploads each need the other. The back-edge is a delegate that resolves on first call,
 * after both are built, so no repository needs a setter to be wired.
 */
export function graph(): Container {
  return new Container()
    .provide(Repo.outbox, () => new InMemoryOutboxRepository())
    .provide(Repo.renditions, () => new InMemoryRenditionRepository())
    .provide(Repo.steps, () => new InMemoryStepRepository())
    .provide(Repo.users, () => new InMemoryUserRepository())
    .provide(Repo.userEvents, (c) => new InMemoryUserEventRepository(c.get(Repo.outbox)))
    .provide(Repo.channels, (c) => new InMemoryChannelRepository(c.get(Repo.videos)))
    .provide(Repo.events, () => new InMemoryEventRepository())
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
        })
    )
    .provide(Repo.uploads, (c) => new InMemoryUploadRepository({ videosRepo: c.get(Repo.videos) }))
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
      Repo.comments,
      (c) =>
        new InMemoryCommentRepository({
          channelsRepo: c.get(Repo.channels),
          videosRepo: c.get(Repo.videos),
          outboxRepo: c.get(Repo.outbox),
          reportsRepo: c.get(Repo.commentReports),
          userEventsRepo: c.get(Repo.userEvents),
        })
    )
    .provide(
      Repo.commentReports,
      (c) =>
        new InMemoryCommentReportRepository({
          commentsRepo: { peek: (id) => c.get(Repo.comments).peek(id) },
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
    .provide(Repo.notifications, (c) => new InMemoryNotificationRepository(c.get(Repo.userEvents)))
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
    .provide(
      Repo.related,
      (c) =>
        new InMemoryRelatedVideosRepository({
          videosRepo: c.get(Repo.videos),
          historyRepo: c.get(Repo.watchHistory),
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
    .provide(
      Repo.picks,
      (c) =>
        new InMemoryPickRepository({
          videosRepo: c.get(Repo.videos),
          channelsRepo: c.get(Repo.channels),
        })
    );
}
