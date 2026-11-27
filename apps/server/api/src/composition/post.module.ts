import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { PostService } from '../services/index';
import { Services } from './service-tokens';

export function registerPostServices(c: Container): Container {
  return c.provide(Services.PostService, (c) => {
    const repositories = c.get(Adapters.Repositories);
    return new PostService({
      posts: repositories.channelPosts,
      channels: repositories.channels,
      images: repositories.channelImages,
      videos: repositories.videos,
      playlists: repositories.playlists,
      commentCache: c.get(Adapters.CommentCache),
      cdn: c.get(Adapters.Config).cdn,
      paginator: c.get(Services.Paginator),
      now: Date.now,
    });
  });
}
