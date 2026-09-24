import type { Category } from '@vp/domain';
import { inProcessAppConfig } from '@vp/env-schema';
import { cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { err, ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { RedisCategoryCacheAdapter } from '../redis-category-cache.adapter';

const CACHES = inProcessAppConfig().caches;

function category(overrides: Partial<Category> & { id: string }): Category {
  return {
    slug: overrides.id,
    name: overrides.id,
    description: null,
    iconUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const MUSIC = category({ id: 'music', name: 'Music', sortOrder: 2 });
const GAMING = category({ id: 'gaming', name: 'Gaming', sortOrder: 1 });
const ART = category({ id: 'art', name: 'Art', sortOrder: 1 });

describe('RedisCategoryCacheAdapter', () => {
  let cache: InMemoryCacheClient;
  let service: RedisCategoryCacheAdapter;
  let fetches: number;

  const fetcher = async () => {
    fetches += 1;
    return ok([MUSIC, GAMING, ART]);
  };

  beforeEach(() => {
    fetches = 0;
    cache = new InMemoryCacheClient();
    service = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
  });

  afterEach(async () => {
    await service.close();
  });

  it('sorts the fetched categories by sort order then name', async () => {
    const categories = expectOk(await service.getCategories(fetcher));
    expect(categories.map((c) => c.id)).toEqual(['art', 'gaming', 'music']);
  });

  it('serves the second read from L1 without touching the source', async () => {
    expectOk(await service.getCategories(fetcher));
    expectOk(await service.getCategories(fetcher));

    expect(fetches).toBe(1);
    expect(service.getL1Size()).toBe(1);
  });

  it('rehydrates from the shared L2 cache when L1 is cold', async () => {
    const first = expectOk(await service.getCategories(fetcher));

    const replica = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
    const second = expectOk(await replica.getCategories(fetcher));

    expect(fetches).toBe(1);
    expect(second).toEqual(first);
    expect(second.map((c) => c.id)).toEqual(['art', 'gaming', 'music']);
    await replica.close();
  });

  it('revives the dates that a JSON round trip flattened', async () => {
    expectOk(await service.getCategories(fetcher));

    const replica = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
    const categories = expectOk(await replica.getCategories(fetcher));

    expect(categories[0]?.createdAt).toBeInstanceOf(Date);
    expect(categories[0]?.updatedAt).toBeInstanceOf(Date);
    await replica.close();
  });

  it('writes L2 under the shared key with the configured ttl', async () => {
    expectOk(await service.getCategories(fetcher));
    expect(await cache.get(CacheKeys.categories)).not.toBeNull();
  });

  it('expires an L1 entry once its ttl has passed', async () => {
    const shortLived = new RedisCategoryCacheAdapter({
      ...CACHES.categories,
      cache: null,
      l1TtlMs: -1,
    });

    expectOk(await shortLived.getCategories(fetcher));
    expectOk(await shortLived.getCategories(fetcher));

    expect(fetches).toBe(2);
    await shortLived.close();
  });

  it('evicts the oldest entry once L1 is full', async () => {
    const tiny = new RedisCategoryCacheAdapter({
      ...CACHES.categories,
      cache: null,
      maxL1Entries: 1,
    });
    expectOk(await tiny.getCategories(fetcher));

    expect(tiny.getL1Size()).toBe(1);
    await tiny.close();
  });

  it('clears L2 and announces the invalidation to the other replicas', async () => {
    expectOk(await service.getCategories(fetcher));
    await service.invalidate();

    expect(service.getL1Size()).toBe(0);
    expect(expectOk(await cache.get(CacheKeys.categories))).toBeNull();
    expect(cache.publishedMessages.at(-1)?.channel).toBe(CacheKeys.categoriesInvalidated);
  });

  it('opens no subscription until it is started', async () => {
    const replica = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
    expectOk(await replica.getCategories(fetcher));

    await cache.publish(CacheKeys.categoriesInvalidated, JSON.stringify({ invalidatedAt: 1 }));

    expect(replica.getL1Size()).toBe(1);
    await replica.close();
  });

  it('drops its own L1 when another replica announces an invalidation', async () => {
    const replica = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
    expectOk(await replica.start());
    expectOk(await replica.getCategories(fetcher));
    expect(replica.getL1Size()).toBe(1);

    await cache.publish(CacheKeys.categoriesInvalidated, JSON.stringify({ invalidatedAt: 1 }));

    expect(replica.getL1Size()).toBe(0);
    await replica.close();
  });

  it('stops listening for invalidations once closed', async () => {
    const replica = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
    expectOk(await replica.start());
    expectOk(await replica.getCategories(fetcher));
    await replica.close();
    expectOk(await replica.getCategories(fetcher));

    await cache.publish(CacheKeys.categoriesInvalidated, JSON.stringify({ invalidatedAt: 1 }));
    expect(replica.getL1Size()).toBe(1);
  });

  it('falls back to the source when the distributed cache is unusable', async () => {
    const broken = new RedisCategoryCacheAdapter({
      ...CACHES.categories,
      cache: Object.assign(new InMemoryCacheClient(), {
        get: async () => err(cacheUnavailable('get')),
        set: async () => err(cacheUnavailable('set')),
      }),
    });

    const categories = expectOk(await broken.getCategories(fetcher));
    expect(categories.map((c) => c.id)).toEqual(['art', 'gaming', 'music']);
    expect(fetches).toBe(1);
    await broken.close();
  });

  it('serves reads when it cannot subscribe to the invalidation channel', async () => {
    const unreachable = new RedisCategoryCacheAdapter({
      ...CACHES.categories,
      cache: Object.assign(new InMemoryCacheClient(), {
        subscribe: async () => err(cacheUnavailable('subscribe')),
      }),
    });
    expectOk(await unreachable.start());

    expect(expectOk(await unreachable.getCategories(fetcher))).toHaveLength(3);
    await unreachable.close();
  });

  it('closes cleanly when it cannot unsubscribe', async () => {
    const unreachable = new RedisCategoryCacheAdapter({
      ...CACHES.categories,
      cache: Object.assign(new InMemoryCacheClient(), {
        unsubscribe: async () => err(cacheUnavailable('unsubscribe')),
      }),
    });

    await unreachable.close();

    expect(unreachable.getL1Size()).toBe(0);
  });

  it('works with no distributed cache at all', async () => {
    const local = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache: null });

    const categories = expectOk(await local.getCategories(fetcher));
    expect(categories).toHaveLength(3);

    await local.invalidate();
    expect(local.getL1Size()).toBe(0);
    await local.close();
  });
});
