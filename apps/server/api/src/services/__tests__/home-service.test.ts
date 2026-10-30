import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisPlayheadCacheAdapter } from '@vp/adapters/redis';
import type { NewVideoInput } from '@vp/core/repositories';
import type { FeedbackTarget } from '@vp/domain';
import { Paginator } from '@vp/pagination';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { HistoryPause } from '../history-pause';
import { HomeService } from '../home-service';
import { RelatedService } from '../related-service';
import { VideoService } from '../video-service';
import { ViewerProgress } from '../viewer-progress';
import { WatchHistoryService } from '../watch-history-service';
import { TEST_CDN, TEST_SPRITE, videoServiceDeps } from './service-deps';

const VIEWER = { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' } as const;
const CREATOR = '00000000-0000-7000-8000-0000000000a2';
const OTHER = '00000000-0000-7000-8000-0000000000a3';
const MUSIC = '00000000-0000-7000-8000-0000000000b1';
const GAMING = '00000000-0000-7000-8000-0000000000b2';
const NIGHT = '00000000-0000-7000-8000-0000000000c1';
const TRAM = '00000000-0000-7000-8000-0000000000c2';
const FOOD = '00000000-0000-7000-8000-0000000000c3';
const CLIP = '00000000-0000-7000-8000-0000000000c4';

describe('apps/server/api/services: HomeService', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let service: HomeService;
  let creatorChannelId: string;

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

  const watch = (videoId: string, progressSeconds: number, minutesAgo: number) =>
    repositories.watchHistory.record({
      id: `00000000-0000-7000-8000-0000000007${videoId.slice(-2)}`,
      userId: VIEWER.id,
      videoId,
      progressSeconds,
      durationSeconds: 100,
      watchedAt: new Date(Date.now() - minutesAgo * 60_000),
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    const viewerProgress = new ViewerProgress(repositories.watchHistory);
    const videoService = new VideoService(
      videoServiceDeps(repositories.videos, { channels: repositories.channels })
    );
    service = new HomeService({
      videoService,
      related: new RelatedService({
        videos: repositories.videos,
        related: repositories.related,
        feedback: repositories.recommendationFeedback,
        videoService,
        viewerProgress,
      }),
      history: repositories.watchHistory,
      subscriptions: repositories.subscriptions,
      categories: repositories.categories,
      feedback: repositories.recommendationFeedback,
      viewerProgress,
      cache,
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
    creatorChannelId = creator.id;
    await publish(NIGHT, { ownerId: CREATOR, categoryId: MUSIC, tags: ['lisbon'] });
    await publish(TRAM, { ownerId: OTHER, categoryId: MUSIC, tags: ['lisbon'] });
    await publish(FOOD, { ownerId: OTHER, categoryId: MUSIC, tags: ['lisbon'] });
    await publish(CLIP, { ownerId: CREATOR, categoryId: GAMING });
    await repositories.subscriptions.subscribe(VIEWER.id, creator.id);
    await watch(NIGHT, 30, 10);
    await watch(TRAM, 60, 1);
  });

  it.each([
    {
      who: 'a signed-in viewer with history',
      viewer: VIEWER,
      kinds: ['continue', 'subscriptions', 'because-watched', 'category', 'category', 'trending'],
    },
    { who: 'a signed-out visitor', viewer: null, kinds: ['category', 'category', 'trending'] },
  ])('shows $who the shelves $kinds', async ({ viewer, kinds }) => {
    const { shelves } = expectOk(await service.get(viewer));

    expect(shelves.map((shelf) => shelf.kind)).toEqual(kinds);
  });

  it('tags every item with the reason it was picked, and the shelf with its subject', async () => {
    const { shelves } = expectOk(await service.get(VIEWER));

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
    const findMany = vi.spyOn(repositories.watchHistory, 'findMany');

    const { shelves } = expectOk(await service.get(VIEWER));

    const night = shelves.flatMap(({ items }) => items).find(({ id }) => id === NIGHT);
    expect(night?.viewer).toMatchObject({ progressSeconds: 30 });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('serves a signed-in viewer a cached page until a new watch drops it', async () => {
    const watchHistory = new WatchHistoryService({
      history: repositories.watchHistory,
      pause: new HistoryPause(repositories.userPreferences),
      videos: repositories.videos,
      playheads: new RedisPlayheadCacheAdapter({ cache, ttlSeconds: 60 }),
      home: service,
      paginator: new Paginator(),
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
      flushIntervalMs: 60_000,
      now: Date.now,
    });
    const continueIds = async () =>
      expectOk(await service.get(VIEWER)).shelves[0]?.items.map(({ id }) => id);
    expect(await continueIds()).toEqual([TRAM, NIGHT]);

    await repositories.watchHistory.record({
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

  describe('with feedback', () => {
    const hide = (target: FeedbackTarget, userId: string = VIEWER.id) =>
      repositories.recommendationFeedback.put({
        ...target,
        id: uuidv7(),
        userId,
        createdAt: new Date(),
      });

    const shelvesOf = async () =>
      expectOk(await service.get(VIEWER)).shelves.map(({ kind, subject, items }) => [
        subject ? `${kind}:${subject.id}` : kind,
        items.map(({ id }) => id).sort(),
      ]);

    it.each([
      {
        scenario: 'a hidden video leaves every shelf and takes a shelf it emptied with it',
        target: (): FeedbackTarget => ({ kind: 'not_interested', videoId: FOOD }),
        expected: [
          ['continue', [NIGHT, TRAM].sort()],
          ['subscriptions', [CLIP, NIGHT].sort()],
          [`category:${MUSIC}`, [NIGHT, TRAM].sort()],
          [`category:${GAMING}`, [CLIP]],
          ['trending', [CLIP, NIGHT, TRAM].sort()],
        ],
      },
      {
        scenario: 'a hidden channel leaves every shelf but continue and subscriptions',
        target: (): FeedbackTarget => ({ kind: 'hide_channel', channelId: creatorChannelId }),
        expected: [
          ['continue', [NIGHT, TRAM].sort()],
          ['subscriptions', [CLIP, NIGHT].sort()],
          [`because-watched:${TRAM}`, [FOOD]],
          [`category:${MUSIC}`, [FOOD, TRAM].sort()],
          ['trending', [FOOD, TRAM].sort()],
        ],
      },
      {
        scenario: 'a hidden video the viewer is watching stays in continue',
        target: (): FeedbackTarget => ({ kind: 'not_interested', videoId: TRAM }),
        expected: [
          ['continue', [NIGHT, TRAM].sort()],
          ['subscriptions', [CLIP, NIGHT].sort()],
          [`because-watched:${TRAM}`, [FOOD]],
          [`category:${MUSIC}`, [FOOD, NIGHT].sort()],
          [`category:${GAMING}`, [CLIP]],
          ['trending', [CLIP, FOOD, NIGHT].sort()],
        ],
      },
    ])('$scenario', async ({ target, expected }) => {
      await hide(target());

      expect(await shelvesOf()).toEqual(expected);
    });

    it('filters nothing for a visitor and nothing of another viewer', async () => {
      await hide({ kind: 'not_interested', videoId: FOOD }, OTHER);

      const shelves = expectOk(await service.get(null)).shelves;

      expect(shelves.flatMap(({ items }) => items.map(({ id }) => id))).toContain(FOOD);
      expect((await shelvesOf()).map(([kind]) => kind)).toContain(`because-watched:${TRAM}`);
    });
  });
});
