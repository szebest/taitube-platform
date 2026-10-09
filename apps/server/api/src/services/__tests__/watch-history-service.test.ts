import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisPlayheadCacheAdapter } from '@vp/adapters/redis';
import { MS_PER_HOUR, MS_PER_MINUTE, SECONDS_PER_DAY } from '@vp/domain/time';
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
const MONDAY = Date.parse('2026-03-02T20:00:00.000Z');
const TUESDAY = MONDAY + 24 * MS_PER_HOUR;

describe('WatchHistoryService', () => {
  let repositories: InMemoryRepositories;
  let playheads: RedisPlayheadCacheAdapter;
  let service: WatchHistoryService;
  let clock: number;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    playheads = new RedisPlayheadCacheAdapter({
      cache: new InMemoryCacheClient(),
      ttlSeconds: 7 * SECONDS_PER_DAY,
    });
    clock = MONDAY;
    service = new WatchHistoryService({
      history: repositories.watchHistory,
      videos: repositories.videos,
      playheads,
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
      cdn: asCdnBase('http://cdn.test'),
      flushIntervalMs: MS_PER_MINUTE,
      now: () => clock,
    });
    await seedVideo(repositories, { id: VIDEO, ownerId: VIEWER.id, title: 'Clip' });
  });

  const save = (progressSeconds: number, reason: 'heartbeat' | 'pause' | 'ended' = 'pause') =>
    service.record(VIEWER, { videoId: VIDEO, progressSeconds, durationSeconds: 120, reason });

  it('writes a long-lived session through again once a flush interval has passed', async () => {
    const record = vi.spyOn(repositories.watchHistory, 'record');
    expectOk(await save(10, 'heartbeat'));
    clock += 5_000;
    expectOk(await save(15, 'heartbeat'));
    clock = TUESDAY;
    expectOk(await save(90, 'heartbeat'));

    expect(record).toHaveBeenCalledTimes(2);
    const [entry] = expectOk(await service.list(VIEWER, {})).items;
    expect(entry).toMatchObject({
      progressSeconds: 90,
      watchedAt: new Date(TUESDAY).toISOString(),
    });
  });

  it('keeps the flush stamp of the last write through while beats stay in the buffer', async () => {
    expectOk(await save(10, 'heartbeat'));
    clock += 5_000;
    expectOk(await save(15, 'heartbeat'));

    expect(expectOk(await playheads.read(VIEWER.id, VIDEO))).toMatchObject({
      progressSeconds: 15,
      flushedAt: new Date(MONDAY),
    });
  });

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
