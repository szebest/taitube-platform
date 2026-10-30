import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { CurrentPickView } from '@vp/api-contracts';
import { cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { CurrentPickCache } from '../current-pick-cache';
import { toFallbackView } from '../pick-views';
import { toVideoSummaryView, type VideoSummaryView } from '../video-views';
import { seedVideo } from '../../__tests__/test-app';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const CAP = 60;

describe('apps/server/api/services: CurrentPickCache', () => {
  let store: InMemoryCacheClient;
  let cache: CurrentPickCache;
  let video: VideoSummaryView;

  const scheduled = (startsAt: string, endsAt: string): CurrentPickView => ({
    source: 'scheduled',
    video,
    note: 'Worth it',
    startsAt,
    endsAt,
  });

  beforeEach(async () => {
    store = new InMemoryCacheClient();
    cache = new CurrentPickCache(store, CAP);
    const seeded = await seedVideo(new InMemoryRepositories(), {
      id: '00000000-0000-7000-8000-00000000f0b1',
      ownerId: '00000000-0000-7000-8000-00000000f0a1',
      title: 'Match',
    });
    video = toVideoSummaryView(seeded, TEST_CDN, TEST_SPRITE, null);
  });

  it('hands back what it wrote while the window holds the instant', async () => {
    const view = scheduled('2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z');

    await cache.write(view, NOW);

    expect(await cache.read(NOW)).toEqual(view);
  });

  it.each([
    { name: 'before the window', at: NOW - 13 * 3_600_000 },
    { name: 'at its end', at: Date.parse('2026-03-02T00:00:00.000Z') },
  ])('reads nothing $name, whatever the store still holds', async ({ at }) => {
    await cache.write(scheduled('2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'), NOW);

    expect(await cache.read(at)).toBeUndefined();
  });

  it.each([
    { name: 'a window with a long way to go', endsAt: '2026-03-02T00:00:00.000Z', ttl: CAP },
    { name: 'a window about to end', endsAt: '2026-03-01T12:00:20.000Z', ttl: 20 },
  ])('keeps $name for $ttl seconds', async ({ endsAt, ttl }) => {
    const set = vi.spyOn(store, 'set');

    await cache.write(scheduled('2026-03-01T00:00:00.000Z', endsAt), NOW);

    expect(set).toHaveBeenCalledWith(CacheKeys.currentPick, expect.any(String), ttl);
  });

  it.each([
    { name: 'a fallback, which has no end', view: () => toFallbackView(video) },
    {
      name: 'a window ending within the second',
      view: () => scheduled('2026-03-01T00:00:00.000Z', '2026-03-01T12:00:00.500Z'),
    },
  ])('does not keep $name', async ({ view }) => {
    await cache.write(view(), NOW);

    expect(expectOk(await store.get(CacheKeys.currentPick))).toBeNull();
  });

  it.each([
    { name: 'text that is not JSON', value: 'nope' },
    { name: 'JSON of another shape', value: '{"a":1}' },
  ])('treats $name as a miss', async ({ value }) => {
    await store.set(CacheKeys.currentPick, value);

    expect(await cache.read(NOW)).toBeUndefined();
  });

  it('forgets the entry on drop', async () => {
    await cache.write(scheduled('2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'), NOW);

    await cache.drop();

    expect(await cache.read(NOW)).toBeUndefined();
  });

  it('carries on when the store is down', async () => {
    const down = new CurrentPickCache(
      Object.assign(new InMemoryCacheClient(), {
        get: async () => err(cacheUnavailable('get', new Error('down'))),
        set: async () => err(cacheUnavailable('set', new Error('down'))),
        del: async () => err(cacheUnavailable('del', new Error('down'))),
      }),
      CAP
    );

    await expect(
      down.write(scheduled('2026-03-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z'), NOW)
    ).resolves.toBeUndefined();
    await expect(down.read(NOW)).resolves.toBeUndefined();
    await expect(down.drop()).resolves.toBeUndefined();
  });
});
