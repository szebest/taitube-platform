import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { PostEngagementService, PostManageService, PostService } from '../services/index';
import { Services } from './service-tokens';

export function registerPostServices(c: Container): Container {
  return c
    .provide(Services.PostService, (c) => {
      const repositories = c.get(Adapters.Repositories);
      return new PostService({
        posts: repositories.channelPosts,
        channels: repositories.channels,
        images: repositories.channelImages,
        videos: repositories.videos,
        playlists: repositories.playlists,
        engagement: repositories.postEngagement,
        commentCache: c.get(Adapters.CommentCache),
        cdn: c.get(Adapters.Config).cdn,
        paginator: c.get(Services.Paginator),
        now: Date.now,
      });
    })
    .provide(Services.PostManageService, (c) => {
      const repositories = c.get(Adapters.Repositories);
      return new PostManageService({
        posts: repositories.channelPosts,
        channels: repositories.channels,
        images: repositories.channelImages,
        videos: repositories.videos,
        playlists: repositories.playlists,
        engagement: repositories.postEngagement,
        cdn: c.get(Adapters.Config).cdn,
        paginator: c.get(Services.Paginator),
        now: Date.now,
      });
    })
    .provide(Services.PostEngagementService, (c) => {
      const repositories = c.get(Adapters.Repositories);
      return new PostEngagementService({
        posts: c.get(Services.PostService),
        engagement: repositories.postEngagement,
        restrictions: repositories.channelUserRestrictions,
        openSketch: c.get(Adapters.PostOpenSketch),
        now: Date.now,
      });
    });
}
