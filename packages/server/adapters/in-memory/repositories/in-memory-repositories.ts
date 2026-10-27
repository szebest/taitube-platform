import { Container, token } from '@vp/composition';
import type { Repositories } from '@vp/core/repositories';
import { InMemoryCaptionRepository } from './in-memory-caption-repository';
import { InMemoryCategoryRepository } from './in-memory-category-repository';
import { InMemoryChannelRepository } from './in-memory-channel-repository';
import { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import { InMemoryCommentRepository } from './in-memory-comment-repository';
import { InMemoryDlqRepository } from './in-memory-dlq-repository';
import { InMemoryEventRepository } from './in-memory-event-repository';
import { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import { InMemoryRelatedVideosRepository } from './in-memory-related-videos-repository';
import { InMemoryRenditionRepository } from './in-memory-rendition-repository';
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

const Repo = {
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
  search: token<InMemorySearchRepository>('search'),
  related: token<InMemoryRelatedVideosRepository>('related'),
  captions: token<InMemoryCaptionRepository>('captions'),
} as const;

/**
 * Videos and uploads each need the other. The back-edge is a delegate that resolves on first call,
 * after both are built, so no repository needs a setter to be wired.
 */
function graph(): Container {
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
      (c) => new InMemoryVideoReactionRepository({ videosRepo: c.get(Repo.videos) })
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
    .provide(
      Repo.search,
      (c) =>
        new InMemorySearchRepository({
          videosRepo: c.get(Repo.videos),
          channelsRepo: c.get(Repo.channels),
          playlistsRepo: c.get(Repo.playlists),
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
      Repo.captions,
      (c) =>
        new InMemoryCaptionRepository({
          videos: c.get(Repo.videos),
          channels: c.get(Repo.channels),
          events: c.get(Repo.events),
          userEvents: c.get(Repo.userEvents),
        })
    );
}

export class InMemoryRepositories implements Repositories {
  readonly events: InMemoryEventRepository;
  readonly renditions: InMemoryRenditionRepository;
  readonly steps: InMemoryStepRepository;
  readonly users: InMemoryUserRepository;
  readonly userEvents: InMemoryUserEventRepository;
  readonly videos: InMemoryVideoRepository;
  readonly videoStudio: InMemoryVideoStudioRepository;
  readonly uploads: InMemoryUploadRepository;
  readonly dlq: InMemoryDlqRepository;
  readonly outbox: InMemoryOutboxRepository;
  readonly categories: InMemoryCategoryRepository;
  readonly channels: InMemoryChannelRepository;
  readonly videoReactions: InMemoryVideoReactionRepository;
  readonly subscriptions: InMemorySubscriptionRepository;
  readonly videoViews: InMemoryVideoViewRepository;
  readonly comments: InMemoryCommentRepository;
  readonly commentReports: InMemoryCommentReportRepository;
  readonly playlists: InMemoryPlaylistRepository;
  readonly watchHistory: InMemoryWatchHistoryRepository;
  readonly userPreferences: InMemoryUserPreferencesRepository;
  readonly search: InMemorySearchRepository;
  readonly related: InMemoryRelatedVideosRepository;
  readonly captions: InMemoryCaptionRepository;

  constructor() {
    const c = graph();
    this.events = c.get(Repo.events);
    this.renditions = c.get(Repo.renditions);
    this.steps = c.get(Repo.steps);
    this.users = c.get(Repo.users);
    this.userEvents = c.get(Repo.userEvents);
    this.videos = c.get(Repo.videos);
    this.videoStudio = c.get(Repo.videoStudio);
    this.uploads = c.get(Repo.uploads);
    this.dlq = c.get(Repo.dlq);
    this.outbox = c.get(Repo.outbox);
    this.categories = c.get(Repo.categories);
    this.channels = c.get(Repo.channels);
    this.videoReactions = c.get(Repo.videoReactions);
    this.subscriptions = c.get(Repo.subscriptions);
    this.videoViews = c.get(Repo.videoViews);
    this.comments = c.get(Repo.comments);
    this.commentReports = c.get(Repo.commentReports);
    this.playlists = c.get(Repo.playlists);
    this.watchHistory = c.get(Repo.watchHistory);
    this.userPreferences = c.get(Repo.userPreferences);
    this.search = c.get(Repo.search);
    this.related = c.get(Repo.related);
    this.captions = c.get(Repo.captions);
  }

  clear(): void {
    for (const name of Object.keys(Repo) as (keyof typeof Repo)[]) {
      this[name].clear();
    }
  }
}
