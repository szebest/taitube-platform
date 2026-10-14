import { CaslAuthorizationAdapter } from '@vp/adapters/authorization';
import {
  InMemoryCacheClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  type InMemoryRepositories,
} from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import type { StorageClient } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import { asCdnBase, inProcessAppConfig } from '@vp/env-schema';
import { Paginator } from '@vp/pagination';
import type { UploadContext } from '../upload-context';
import type { VideoServiceDeps } from '../video-service';

const CACHES = inProcessAppConfig().caches;

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
      ...CACHES.reactions,
      backend: { type: 'cache', cache: new InMemoryCacheClient() },
    }),
    authorization: new CaslAuthorizationAdapter(),
    paginator: new Paginator(),
    probeQueue: new InMemoryJobQueue('probe'),
    ...overrides,
  };
}

/** The upload collaborators and limits a case does not exercise, over one repositories bundle. */
export function uploadContext(
  repositories: InMemoryRepositories,
  storage: StorageClient,
  overrides: Partial<UploadContext> = {}
): UploadContext {
  return {
    uploads: repositories.uploads,
    videos: repositories.videos,
    events: repositories.events,
    users: repositories.users,
    storage,
    multipart: new InMemoryMultipartStorage(storage),
    probeQueue: new InMemoryJobQueue('probe'),
    rawBucket: 'raw',
    multipartThresholdBytes: 10 * 1024 * 1024,
    partSizeMinBytes: 8 * 1024 * 1024,
    partSizeMaxBytes: 64 * 1024 * 1024,
    presignedUrlTtlSeconds: 900,
    uploadSessionTtlSeconds: 86_400,
    maxInflightPerUser: 3,
    ...overrides,
  };
}
