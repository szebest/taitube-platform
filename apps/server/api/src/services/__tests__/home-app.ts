import { expectOk } from '@kit/testing/result';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { DiscoveryShelves } from '../discovery-shelves';
import { ExperimentOverlay } from '../experiment-overlay';
import { HomeService } from '../home-service';
import { RelatedService } from '../related-service';
import { SearchService } from '../search-service';
import { VideoService } from '../video-service';
import { ViewerProgress } from '../viewer-progress';
import { searchServiceDeps, videoServiceDeps } from './service-deps';

export const VIEWER = { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' } as const;
const CREATOR = '00000000-0000-7000-8000-0000000000a2';
export const OTHER = '00000000-0000-7000-8000-0000000000a3';
export const MUSIC = '00000000-0000-7000-8000-0000000000b1';
export const GAMING = '00000000-0000-7000-8000-0000000000b2';
export const NIGHT = '00000000-0000-7000-8000-0000000000c1';
export const TRAM = '00000000-0000-7000-8000-0000000000c2';
export const FOOD = '00000000-0000-7000-8000-0000000000c3';
export const CLIP = '00000000-0000-7000-8000-0000000000c4';

export interface HomeApp {
  repositories: InMemoryRepositories;
  cache: InMemoryCacheClient;
  service: HomeService;
  creatorChannelId: string;
}

/** A viewer who watched NIGHT and TRAM and follows the creator of NIGHT and CLIP. */
export async function buildHomeApp(): Promise<HomeApp> {
  const repositories = new InMemoryRepositories();
  const cache = new InMemoryCacheClient();
  const viewerProgress = new ViewerProgress(repositories.watchHistory);
  const experiments = new ExperimentOverlay(repositories.videoExperiments);
  const videoService = new VideoService(
    videoServiceDeps(repositories.videos, { channels: repositories.channels })
  );
  const service = new HomeService({
    videoService,
    related: new RelatedService({
      videos: repositories.videos,
      related: repositories.related,
      feedback: repositories.recommendationFeedback,
      videoService,
      viewerProgress,
      experiments,
    }),
    history: repositories.watchHistory,
    subscriptions: repositories.subscriptions,
    categories: repositories.categories,
    feedback: repositories.recommendationFeedback,
    discovery: new DiscoveryShelves({
      searchHistory: repositories.searchHistory,
      search: new SearchService(searchServiceDeps(repositories, { viewerProgress, experiments })),
      rising: repositories.rising,
      videoService,
      now: Date.now,
    }),
    viewerProgress,
    experiments,
    cache,
  });

  const publish = (
    id: string,
    overrides: Pick<NewVideoInput, 'ownerId'> & Partial<NewVideoInput>
  ) =>
    repositories.videos.create({
      id,
      title: `Video ${id.slice(-2)}`,
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${id}.mp4`,
      ...overrides,
    });

  await repositories.categories.create({ id: MUSIC, slug: 'music', name: 'Music', sortOrder: 1 });
  await repositories.categories.create({
    id: GAMING,
    slug: 'gaming',
    name: 'Gaming',
    sortOrder: 2,
  });
  const creator = expectOk(
    await repositories.channels.create({
      userId: CREATOR,
      handle: 'creator',
      displayName: 'Creator',
    })
  );
  await publish(NIGHT, { ownerId: CREATOR, categoryId: MUSIC, tags: ['lisbon'] });
  await publish(TRAM, { ownerId: OTHER, categoryId: MUSIC, tags: ['lisbon'] });
  await publish(FOOD, { ownerId: OTHER, categoryId: MUSIC, tags: ['lisbon'] });
  await publish(CLIP, { ownerId: CREATOR, categoryId: GAMING });
  await repositories.subscriptions.subscribe(VIEWER.id, creator.id);
  await watchVideo(repositories, NIGHT, 30, 10);
  await watchVideo(repositories, TRAM, 60, 1);

  return { repositories, cache, service, creatorChannelId: creator.id };
}

const watchVideo = (
  repositories: InMemoryRepositories,
  videoId: string,
  progressSeconds: number,
  minutesAgo: number
) =>
  repositories.watchHistory.record({
    id: `00000000-0000-7000-8000-0000000007${videoId.slice(-2)}`,
    userId: VIEWER.id,
    videoId,
    progressSeconds,
    durationSeconds: 100,
    watchedAt: new Date(Date.now() - minutesAgo * 60_000),
  });
