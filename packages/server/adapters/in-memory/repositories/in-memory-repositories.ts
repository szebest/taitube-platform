import type { Repositories } from '@vp/core/repositories';
import type { InMemoryCaptionRepository } from './in-memory-caption-repository';
import type { InMemoryCategoryRepository } from './in-memory-category-repository';
import type { InMemoryChannelFeaturedRepository } from './in-memory-channel-featured-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryClipRepository } from './in-memory-clip-repository';
import type { InMemoryCommentReportRepository } from './in-memory-comment-report-repository';
import type { InMemoryCommentRepository } from './in-memory-comment-repository';
import type { InMemoryDlqRepository } from './in-memory-dlq-repository';
import type { InMemoryEventRepository } from './in-memory-event-repository';
import { graph, Repo } from './in-memory-graph';
import type { InMemoryNotificationRepository } from './in-memory-notification-repository';
import type { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import type { InMemoryPickRepository } from './in-memory-pick-repository';
import type { InMemoryPlaylistRepository } from './in-memory-playlist-repository';
import type { InMemoryRecommendationFeedbackRepository } from './in-memory-recommendation-feedback-repository';
import type { InMemoryRelatedVideosRepository } from './in-memory-related-videos-repository';
import type { InMemoryRenditionRepository } from './in-memory-rendition-repository';
import type { InMemoryRisingVideosRepository } from './in-memory-rising-videos-repository';
import type { InMemorySearchHistoryRepository } from './in-memory-search-history-repository';
import type { InMemorySearchRepository } from './in-memory-search-repository';
import type { InMemoryStepRepository } from './in-memory-step-repository';
import type { InMemorySubscriptionRepository } from './in-memory-subscription-repository';
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
  readonly notifications: InMemoryNotificationRepository;
  readonly search: InMemorySearchRepository;
  readonly searchHistory: InMemorySearchHistoryRepository;
  readonly recommendationFeedback: InMemoryRecommendationFeedbackRepository;
  readonly related: InMemoryRelatedVideosRepository;
  readonly rising: InMemoryRisingVideosRepository;
  readonly captions: InMemoryCaptionRepository;
  readonly clips: InMemoryClipRepository;
  readonly channelFeatured: InMemoryChannelFeaturedRepository;
  readonly picks: InMemoryPickRepository;
  readonly webhooks: InMemoryWebhookRepository;

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
    this.notifications = c.get(Repo.notifications);
    this.search = c.get(Repo.search);
    this.searchHistory = c.get(Repo.searchHistory);
    this.recommendationFeedback = c.get(Repo.recommendationFeedback);
    this.related = c.get(Repo.related);
    this.rising = c.get(Repo.rising);
    this.captions = c.get(Repo.captions);
    this.clips = c.get(Repo.clips);
    this.channelFeatured = c.get(Repo.channelFeatured);
    this.picks = c.get(Repo.picks);
    this.webhooks = c.get(Repo.webhooks);
  }

  clear(): void {
    for (const name of Object.keys(Repo) as (keyof typeof Repo)[]) {
      this[name].clear();
    }
  }
}
