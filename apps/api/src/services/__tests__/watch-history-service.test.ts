import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisPlayheadCacheAdapter } from '@vp/adapters/redis';
import { asCdnBase } from '@vp/env-schema';
import { cacheUnavailable } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { WatchHistoryService } from '../watch-history-service';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000d001', role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-00000000d002';

describe('WatchHistoryService', () => {
  let repositories: InMemoryRepositories;
  let playheads: RedisPlayheadCacheAdapter;
  let service: WatchHistoryService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    playheads = new RedisPlayheadCacheAdapter({ cache: new InMemoryCacheClient(), ttlSeconds: 60 });
    service = new WatchHistoryService({
      history: repositories.watchHistory,
      videos: repositories.videos,
      playheads,
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
      cdn: asCdnBase('http://cdn.test'),
    });
    await seedVideo(repositories, { id: VIDEO, ownerId: VIEWER.id, title: 'Clip' });
  });

  const save = (progressSeconds: number, reason: 'heartbeat' | 'pause' | 'ended' = 'pause') =>
    service.record(VIEWER, { videoId: VIDEO, progressSeconds, durationSeconds: 120, reason });

  it('keeps a playhead reported past the end at the end', async () => {
    expect(expectOk(await save(130, 'ended'))).toMatchObject({
      progressSeconds: 120,
      completed: true,
    });
  });

  it('answers the resume point from the row once the buffer has forgotten it', async () => {
    expectOk(await save(40));
    expectOk(await playheads.forget(VIEWER.id, [VIDEO]));

    expect(expectOk(await service.playhead(VIEWER, VIDEO)).playhead).toMatchObject({
      progressSeconds: 40,
    });
  });

  it('still clears the history when the buffer cannot be reached', async () => {
    expectOk(await save(40));
    vi.spyOn(playheads, 'forget').mockResolvedValue(err(cacheUnavailable('del')));

    expectOk(await service.clear(VIEWER));

    expect(expectOk(await repositories.watchHistory.find(VIEWER.id, VIDEO))).toBeNull();
  });
});
