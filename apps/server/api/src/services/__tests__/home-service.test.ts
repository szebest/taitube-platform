import { RedisPlayheadCacheAdapter } from '@vp/adapters/redis';
import { RISING } from '@vp/domain';
import { Paginator } from '@vp/pagination';
import { expectOk } from '@vp/testing/result';
import { HistoryPause } from '../history-pause';
import { WatchHistoryService } from '../watch-history-service';
import {
  CLIP,
  FOOD,
  GAMING,
  type HomeApp,
  MUSIC,
  NIGHT,
  TRAM,
  VIEWER,
  buildHomeApp,
} from './home-app';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

describe('apps/server/api/services: HomeService', () => {
  let app: HomeApp;

  beforeEach(async () => {
    app = await buildHomeApp();
  });

  it.each([
    {
      who: 'a signed-in viewer with history',
      viewer: VIEWER,
      kinds: ['continue', 'subscriptions', 'because-watched', 'category', 'category', 'trending'],
    },
    { who: 'a signed-out visitor', viewer: null, kinds: ['category', 'category', 'trending'] },
  ])('shows $who the shelves $kinds', async ({ viewer, kinds }) => {
    const { shelves } = expectOk(await app.service.get(viewer));

    expect(shelves.map((shelf) => shelf.kind)).toEqual(kinds);
  });

  it('tags every item with the reason it was picked, and the shelf with its subject', async () => {
    const { shelves } = expectOk(await app.service.get(VIEWER));

    expect(
      shelves.map(({ kind, subject, items }) => ({
        kind,
        subject: subject && { kind: subject.kind, id: subject.id },
        items: items.map(({ id, reason }) => [id, reason.kind]),
      }))
    ).toEqual([
      {
        kind: 'continue',
        items: [
          [TRAM, 'continue'],
          [NIGHT, 'continue'],
        ],
      },
      {
        kind: 'subscriptions',
        items: [
          [CLIP, 'subscription'],
          [NIGHT, 'subscription'],
        ],
      },
      {
        kind: 'because-watched',
        subject: { kind: 'video', id: TRAM },
        items: [[FOOD, 'shared-tags']],
      },
      { kind: 'category', subject: { kind: 'category', id: MUSIC }, items: expect.any(Array) },
      { kind: 'category', subject: { kind: 'category', id: GAMING }, items: [[CLIP, 'category']] },
      { kind: 'trending', items: expect.any(Array) },
    ]);
  });

  it('puts the viewer progress on every item from one batched read', async () => {
    const findMany = vi.spyOn(app.repositories.watchHistory, 'findMany');

    const { shelves } = expectOk(await app.service.get(VIEWER));

    const night = shelves.flatMap(({ items }) => items).find(({ id }) => id === NIGHT);
    expect(night?.viewer).toMatchObject({ progressSeconds: 30 });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('serves a signed-in viewer a cached page until a new watch drops it', async () => {
    const watchHistory = new WatchHistoryService({
      history: app.repositories.watchHistory,
      pause: new HistoryPause(app.repositories.userPreferences),
      videos: app.repositories.videos,
      playheads: new RedisPlayheadCacheAdapter({ cache: app.cache, ttlSeconds: 60 }),
      home: app.service,
      paginator: new Paginator(),
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
      flushIntervalMs: 60_000,
      now: Date.now,
    });
    const continueIds = async () =>
      expectOk(await app.service.get(VIEWER)).shelves[0]?.items.map(({ id }) => id);
    expect(await continueIds()).toEqual([TRAM, NIGHT]);

    await app.repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-000000000799',
      userId: VIEWER.id,
      videoId: FOOD,
      progressSeconds: 10,
      durationSeconds: 100,
      watchedAt: new Date(),
    });
    expect(await continueIds()).toEqual([TRAM, NIGHT]);

    expectOk(
      await watchHistory.record(VIEWER, {
        videoId: CLIP,
        progressSeconds: 5,
        durationSeconds: 100,
        reason: 'pause',
      })
    );

    expect(await continueIds()).toEqual([CLIP, FOOD, TRAM, NIGHT]);
  });

  it('puts a recent search shelf after subscriptions and a rising shelf before trending', async () => {
    await app.repositories.searchHistory.record({
      id: '00000000-0000-7000-8000-0000000009e1',
      userId: VIEWER.id,
      query: 'Video',
      queryKey: 'video',
      searchedAt: new Date(),
    });
    await app.repositories.videoViews.applyBatch({
      batchId: 'retention',
      counts: [],
      retention: [
        { videoId: CLIP, percent: RISING.startPercent, viewers: RISING.minSessions },
        { videoId: CLIP, percent: RISING.completedPercent, viewers: 10 },
      ],
    });

    const kinds = expectOk(await app.service.get(VIEWER)).shelves.map(({ kind }) => kind);

    expect(kinds).toEqual([
      'continue',
      'subscriptions',
      'because-searched',
      'because-watched',
      'category',
      'category',
      'rising',
      'trending',
    ]);
  });
});
