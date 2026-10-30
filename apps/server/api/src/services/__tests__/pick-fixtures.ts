import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { CurrentPickCache } from '../current-pick-cache';
import { CurrentPickService, type CurrentPickServiceDeps } from '../current-pick-service';
import { PickService, type PickServiceDeps } from '../pick-service';
import { toVideoSummaryView } from '../video-views';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

export const HTTP_CACHE = inProcessAppConfig().httpCache.feed;

export const ADMIN: UserContext = { id: '00000000-0000-7000-8000-00000000a001', role: 'ADMIN' };
export const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000a002', role: 'USER' };
export const OWNER = '00000000-0000-7000-8000-00000000a0a1';
export const VIDEO = '00000000-0000-7000-8000-00000000a0b1';
export const SECOND = '00000000-0000-7000-8000-00000000a0b2';
export const TRENDING = '00000000-0000-7000-8000-00000000a0b3';
export const PRIVATE = '00000000-0000-7000-8000-00000000a0b4';
export const PROCESSING = '00000000-0000-7000-8000-00000000a0b5';
export const ABSENT = '00000000-0000-7000-8000-00000000a0b6';
export const NOW = new Date('2026-03-01T12:00:00.000Z').getTime();
export const HOUR = 3_600_000;
export const instant = (ms: number) => new Date(ms).toISOString();

export interface PickWorld {
  repositories: InMemoryRepositories;
  store: InMemoryCacheClient;
  clock: { now: number };
  trending: { items: ReturnType<typeof toVideoSummaryView>[] };
  pickService: (overrides?: Partial<PickServiceDeps>) => PickService;
  currentPickService: (overrides?: Partial<CurrentPickServiceDeps>) => CurrentPickService;
  schedule: (
    service: PickService,
    body?: Partial<Parameters<PickService['create']>[1]>,
    caller?: UserContext | null
  ) => ReturnType<PickService['create']>;
}

export async function pickWorld(): Promise<PickWorld> {
  const repositories = new InMemoryRepositories();
  const store = new InMemoryCacheClient();
  const clock = { now: NOW };
  const trending: PickWorld['trending'] = { items: [] };
  const currentCache = new CurrentPickCache(store, HTTP_CACHE.maxAgeSeconds);

  await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' });
  for (const [id, extra] of [
    [VIDEO, {}],
    [SECOND, {}],
    [TRENDING, {}],
    [PRIVATE, { visibility: 'private' as const }],
    [PROCESSING, { status: 'PROCESSING' as const }],
  ] as const) {
    await seedVideo(repositories, { id, ownerId: OWNER, title: `Video ${id.slice(-2)}`, ...extra });
  }
  const top = expectOk(await repositories.videos.findById(TRENDING));
  trending.items = top ? [toVideoSummaryView(top, TEST_CDN, TEST_SPRITE, null)] : [];

  return {
    repositories,
    store,
    clock,
    trending,
    pickService: (overrides = {}) =>
      new PickService({
        picks: repositories.picks,
        videos: repositories.videos,
        channels: repositories.channels,
        currentCache,
        cdn: TEST_CDN,
        sprite: TEST_SPRITE,
        defaultRangeMs: inProcessAppConfig().picks.defaultRangeMs,
        now: () => clock.now,
        ...overrides,
      }),
    currentPickService: (overrides = {}) =>
      new CurrentPickService({
        picks: repositories.picks,
        feed: {
          getFeed: async () =>
            ok({
              data: { items: trending.items, nextCursor: null, total: trending.items.length },
              etag: '"x"',
              headers: {},
              notModified: false,
            }),
        },
        currentCache,
        cdn: TEST_CDN,
        sprite: TEST_SPRITE,
        ...HTTP_CACHE,
        now: () => clock.now,
        ...overrides,
      }),
    schedule: (service, body = {}, caller = ADMIN) =>
      service.create(caller, {
        videoId: VIDEO,
        startsAt: instant(NOW - HOUR),
        endsAt: instant(NOW + 14 * HOUR),
        note: 'Worth the ten minutes',
        ...body,
      }),
  };
}
