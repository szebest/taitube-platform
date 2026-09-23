import { CaslAuthorizationAdapter, RedisReactionCacheAdapter } from '@vp/adapters';
import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import type { VideoRepository } from '@vp/core/repositories';
import { asCdnBase } from '@vp/env-schema';
import { defaultPaginator } from '@vp/pagination';
import type { VideoServiceDeps } from '../video-service';

export const TEST_CDN = asCdnBase('http://localhost:9000/public');

/** The collaborators a VideoService case does not exercise, at their production shapes. */
export function videoServiceDeps(
  videos: VideoRepository,
  overrides: Partial<VideoServiceDeps> = {}
): VideoServiceDeps {
  return {
    videos,
    cdn: TEST_CDN,
    reactionCache: new RedisReactionCacheAdapter({
      backend: { type: 'cache', cache: new InMemoryCacheClient() },
    }),
    authorization: new CaslAuthorizationAdapter(),
    paginator: defaultPaginator,
    ...overrides,
  };
}
