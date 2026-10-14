import type { Container } from '@vp/composition';
import { Services } from './service-tokens';

/** What `app.services` hands the routes: every service, resolved once the container is built. */
export function registerServiceSet(c: Container): Container {
  return c.provide(Services.ServiceSet, (c) => ({
    videoService: c.get(Services.VideoService),
    creatorStudioService: c.get(Services.CreatorStudioService),
    searchService: c.get(Services.SearchService),
    uploadService: c.get(Services.UploadService),
    feedService: c.get(Services.FeedService),
    categoryService: c.get(Services.CategoryService),
    channelService: c.get(Services.ChannelService),
    reactionService: c.get(Services.ReactionService),
    subscriptionService: c.get(Services.SubscriptionService),
    commentService: c.get(Services.CommentService),
    viewService: c.get(Services.ViewService),
    analyticsService: c.get(Services.AnalyticsService),
    bootstrapService: c.get(Services.BootstrapService),
    playlistService: c.get(Services.PlaylistService),
    watchHistoryService: c.get(Services.WatchHistoryService),
    queueService: c.get(Services.QueueService),
    dlqService: c.get(Services.DlqService),
    sseService: c.get(Services.SseService),
    sseHub: c.get(Services.SseHub),
    readiness: c.get(Services.Readiness),
    queueBoard: c.get(Services.QueueBoard),
  }));
}
