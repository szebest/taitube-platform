import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisPlayheadCacheAdapter } from '@vp/adapters/redis';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { MS_PER_HOUR, MS_PER_MINUTE, SECONDS_PER_DAY } from '@vp/domain/time';
import { asCdnBase } from '@vp/env-schema';
import { cacheUnavailable, ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { HistoryPause } from '../history-pause';
import { WatchHistoryService } from '../watch-history-service';
import { TEST_SPRITE } from './service-deps';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000d001', role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-00000000d002';
const PRIVATE = '00000000-0000-7000-8000-00000000d003';
const ABSENT = '00000000-0000-7000-8000-00000000d004';
const OWNER = '00000000-0000-7000-8000-00000000d005';
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
      pause: new HistoryPause(repositories.userPreferences),
      videos: repositories.videos,
      playheads,
      home: { forget: async () => {} },
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
      cdn: asCdnBase('http://cdn.test'),
      sprite: TEST_SPRITE,
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

  const pauseHistory = async () => {
    const privacy = { ...DEFAULT_PREFERENCES.privacy, historyPaused: true };
    expectOk(
      await repositories.userPreferences.save({
        userId: VIEWER.id,
        preferences: { appearance: null, playback: null, privacy, notifications: null },
        expectedVersion: 0,
        sections: ['privacy'],
      })
    );
  };

  it('writes no history entry and no playhead while the viewer has paused their history', async () => {
    await pauseHistory();

    expectOk(await save(10, 'heartbeat'));
    expectOk(await save(40));

    expect(expectOk(await repositories.watchHistory.find(VIEWER.id, VIDEO))).toBeNull();
    expect(expectOk(await service.playhead(VIEWER, VIDEO)).playhead).toBeNull();
  });

  it.each([
    { scenario: 'a missing video', videoId: ABSENT },
    { scenario: "another owner's private video", videoId: PRIVATE },
  ])('still refuses $scenario while the history is paused', async ({ videoId }) => {
    await seedVideo(repositories, {
      id: PRIVATE,
      ownerId: OWNER,
      title: 'Closed',
      visibility: 'private',
    });
    await pauseHistory();

    const refused = await service.record(VIEWER, {
      videoId,
      progressSeconds: 5,
      durationSeconds: 120,
      reason: 'pause',
    });

    expect(expectErr(refused).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
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
