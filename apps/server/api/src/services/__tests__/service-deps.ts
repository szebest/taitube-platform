import { CaslAuthorizationAdapter } from '@vp/adapters/authorization';
import {
  InMemoryCacheClient,
  InMemoryChannelRepository,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  type InMemoryRepositories,
  InMemoryVideoRepository,
} from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import type { StorageClient } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import { asCdnBase, inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { Paginator } from '@vp/pagination';
import type { ChannelServiceDeps } from '../channel-service';
import type { SseServiceDeps } from '../sse-service';
import type { UploadContext } from '../upload-context';
import { VideoService, type VideoServiceDeps } from '../video-service';

const CACHES = inProcessAppConfig().caches;

export const TEST_CDN = asCdnBase('http://localhost:9000/public');

export const TEST_SPRITE = inProcessAppConfig().sprite;

export const SSE_REPLAY_LIMIT = 2;

/** The collaborators a VideoService case does not exercise, at their production shapes. */
export function videoServiceDeps(
  videos: VideoRepository,
  overrides: Partial<VideoServiceDeps> = {}
): VideoServiceDeps {
  return {
    videos,
    channels: new InMemoryChannelRepository(new InMemoryVideoRepository()),
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
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

/** A ChannelService over one repositories bundle, its videos read from the same store. */
export function channelServiceDeps(
  repositories: InMemoryRepositories,
  overrides: Partial<ChannelServiceDeps> = {}
): ChannelServiceDeps {
  return {
    users: repositories.users,
    channels: repositories.channels,
    playlists: repositories.playlists,
    videoService: new VideoService(
      videoServiceDeps(repositories.videos, { channels: repositories.channels })
    ),
    paginator: new Paginator(),
    cdn: TEST_CDN,
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

/** An SseService over one repositories bundle, replaying at most SSE_REPLAY_LIMIT events. */
export function sseServiceDeps(
  repositories: InMemoryRepositories,
  overrides: Partial<SseServiceDeps> = {}
): SseServiceDeps {
  return {
    videos: repositories.videos,
    renditions: repositories.renditions,
    events: repositories.events,
    userEvents: repositories.userEvents,
    cdn: TEST_CDN,
    replayLimit: SSE_REPLAY_LIMIT,
    logger: createLogger({ format: 'json', service: 'sse-service-spec', level: 'silent' }),
    ...overrides,
  };
}
