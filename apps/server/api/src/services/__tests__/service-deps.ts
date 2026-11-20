import { Singleflight } from '@kit/concurrency';
import { createLogger } from '@kit/logger';
import { Paginator } from '@kit/pagination';
import { ok } from '@kit/result';
import { CaslAuthorizationAdapter } from '@vp/adapters/authorization';
import {
  InMemoryCacheClient,
  InMemoryChannelHandleHistoryRepository,
  InMemoryChannelRepository,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  type InMemoryRepositories,
  InMemorySearchSuggestionIndex,
  InMemoryStepRepository,
  InMemoryVideoChapterRepository,
  InMemoryVideoRepository,
} from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import type { StorageClient } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import { type ActingChannel, SEARCH_SUGGESTIONS } from '@vp/domain';
import { asCdnBase, inProcessAppConfig } from '@vp/env-schema';
import {
  ChannelIdentityService,
  type ChannelIdentityServiceDeps,
} from '../channel-identity-service';
import type { ChannelServiceDeps } from '../channel-service';
import { CreatorStudioService } from '../creator-studio-service';
import { ExperimentOverlay } from '../experiment-overlay';
import { HistoryPause } from '../history-pause';
import { MetadataScreening } from '../metadata-screening';
import type { SearchServiceDeps } from '../search-service';
import type { SseServiceDeps } from '../sse-service';
import type { UploadContext } from '../upload-context';
import { VideoService, type VideoServiceDeps } from '../video-service';
import { ViewerProgress } from '../viewer-progress';

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
    channels: new InMemoryChannelRepository(
      new InMemoryVideoRepository(),
      new InMemoryChannelHandleHistoryRepository()
    ),
    chapters: new InMemoryVideoChapterRepository(),
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
    reactionCache: new RedisReactionCacheAdapter({
      ...CACHES.reactions,
      backend: { type: 'cache', cache: new InMemoryCacheClient() },
    }),
    authorization: new CaslAuthorizationAdapter(),
    paginator: new Paginator(),
    steps: new InMemoryStepRepository(),
    probeQueue: new InMemoryJobQueue('probe'),
    ...overrides,
  };
}

export function ownerActing(ownerId: string, channelId: string): ActingChannel {
  return { channelId, ownerId, role: 'owner' };
}

export const TEST_NOW = Date.parse('2026-03-10T00:00:00.000Z');

/** The channel identity rules over one repositories bundle, at a fixed clock. */
export function channelIdentityServiceDeps(
  repositories: InMemoryRepositories,
  overrides: Partial<ChannelIdentityServiceDeps> = {}
): ChannelIdentityServiceDeps {
  return {
    channels: repositories.channels,
    handleHistory: repositories.channelHandleHistory,
    audit: repositories.channelAudit,
    now: () => TEST_NOW,
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
    captions: repositories.captions,
    liveStreams: repositories.liveStreams,
    playlists: repositories.playlists,
    videoService: new VideoService(
      videoServiceDeps(repositories.videos, { channels: repositories.channels })
    ),
    paginator: new Paginator(),
    cdn: TEST_CDN,
    identity: new ChannelIdentityService(channelIdentityServiceDeps(repositories)),
    pages: repositories.channelPages,
    now: () => TEST_NOW,
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
    notifications: repositories.notifications,
    liveStreams: repositories.liveStreams,
    liveViewers: async () => ok(0),
    cdn: TEST_CDN,
    replayLimit: SSE_REPLAY_LIMIT,
    logger: createLogger({ format: 'json', service: 'sse-service-spec', level: 'silent' }),
    ...overrides,
  };
}

/** The edit screening switched on, over the same repositories as the service under test. */
export function metadataScreeningOf(repositories: InMemoryRepositories): MetadataScreening {
  const { thresholds, process } = inProcessAppConfig().screening;
  return new MetadataScreening({
    screenings: repositories.screenings,
    videos: repositories.videos,
    enabled: true,
    thresholds,
    locales: process.metadataLocales,
    recentTitleCount: process.recentTitleCount,
  });
}

export function creatorStudioOf(repositories: InMemoryRepositories): CreatorStudioService {
  return new CreatorStudioService({
    videos: repositories.videos,
    studio: repositories.videoStudio,
    videoService: new VideoService(
      videoServiceDeps(repositories.videos, { chapters: repositories.videoChapters })
    ),
    metadataScreening: metadataScreeningOf(repositories),
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
    channels: repositories.channels,
    paginator: new Paginator(),
  });
}

/** A SearchService over one repositories bundle, with its own cache and suggestion index. */
export function searchServiceDeps(
  repositories: InMemoryRepositories,
  overrides: Partial<SearchServiceDeps> = {}
): SearchServiceDeps {
  return {
    search: repositories.search,
    suggestions: new InMemorySearchSuggestionIndex(Date.now, SEARCH_SUGGESTIONS.keptPerPrefix),
    cache: new InMemoryCacheClient(),
    singleflight: new Singleflight(),
    paginator: new Paginator(),
    viewerProgress: new ViewerProgress(repositories.watchHistory),
    experiments: new ExperimentOverlay(repositories.videoExperiments),
    history: repositories.searchHistory,
    pause: new HistoryPause(repositories.userPreferences),
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
    channels: repositories.channels,
    now: Date.now,
    ...overrides,
  };
}
