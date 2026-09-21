import type { Category } from '@vp/domain';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import {
  CATEGORIES_CACHE_KEY,
  CATEGORIES_INVALIDATION_CHANNEL,
  CategoryCacheService,
} from '../category-cache.service';

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

describe('CategoryCacheService', () => {
  let cache: InMemoryCacheClient;
  let service: CategoryCacheService;
  let fetches: number;

  const fetcher = async () => {
    fetches += 1;
    return [MUSIC, GAMING, ART];
  };

  beforeEach(() => {
    fetches = 0;
    cache = new InMemoryCacheClient();
    service = new CategoryCacheService({ cache });
  });

  afterEach(() => {
    service.close();
  });

  it('sorts the fetched categories by sort order then name', async () => {
    const categories = await service.getCategories(fetcher);
    expect(categories.map((c) => c.id)).toEqual(['art', 'gaming', 'music']);
  });

  it('serves the second read from L1 without touching the source', async () => {
    await service.getCategories(fetcher);
    await service.getCategories(fetcher);

    expect(fetches).toBe(1);
    expect(service.getL1Size()).toBe(1);
  });

  it('rehydrates from the shared L2 cache when L1 is cold', async () => {
    const first = await service.getCategories(fetcher);

    const replica = new CategoryCacheService({ cache });
    const second = await replica.getCategories(fetcher);

    expect(fetches).toBe(1);
    expect(second).toEqual(first);
    expect(second.map((c) => c.id)).toEqual(['art', 'gaming', 'music']);
    replica.close();
  });

  it('revives the dates that a JSON round trip flattened', async () => {
    await service.getCategories(fetcher);

    const replica = new CategoryCacheService({ cache });
    const categories = await replica.getCategories(fetcher);

    expect(categories[0]?.createdAt).toBeInstanceOf(Date);
    expect(categories[0]?.updatedAt).toBeInstanceOf(Date);
    replica.close();
  });

  it('writes L2 under the shared key with the configured ttl', async () => {
    await service.getCategories(fetcher);
    expect(await cache.get(CATEGORIES_CACHE_KEY)).not.toBeNull();
  });

  it('expires an L1 entry once its ttl has passed', async () => {
    const shortLived = new CategoryCacheService({ cache: null, l1TtlMs: -1 });

    await shortLived.getCategories(fetcher);
    await shortLived.getCategories(fetcher);

    expect(fetches).toBe(2);
    shortLived.close();
  });

  it('evicts the oldest entry once L1 is full', async () => {
    const tiny = new CategoryCacheService({ cache: null, maxL1Entries: 1 });
    await tiny.getCategories(fetcher);

    expect(tiny.getL1Size()).toBe(1);
    tiny.close();
  });

  it('clears L2 and announces the invalidation to the other replicas', async () => {
    await service.getCategories(fetcher);
    await service.invalidate();

    expect(service.getL1Size()).toBe(0);
    expect(await cache.get(CATEGORIES_CACHE_KEY)).toBeNull();
    expect(cache.publishedMessages.at(-1)?.channel).toBe(CATEGORIES_INVALIDATION_CHANNEL);
  });

  it('drops its own L1 when another replica announces an invalidation', async () => {
    const replica = new CategoryCacheService({ cache });
    await replica.getCategories(fetcher);
    expect(replica.getL1Size()).toBe(1);

    await cache.publish(CATEGORIES_INVALIDATION_CHANNEL, JSON.stringify({ invalidatedAt: 1 }));

    expect(replica.getL1Size()).toBe(0);
    replica.close();
  });

  it('stops listening for invalidations once closed', async () => {
    const replica = new CategoryCacheService({ cache });
    await replica.getCategories(fetcher);
    replica.close();
    await replica.getCategories(fetcher);

    await cache.publish(CATEGORIES_INVALIDATION_CHANNEL, JSON.stringify({ invalidatedAt: 1 }));
    expect(replica.getL1Size()).toBe(1);
  });

  it('falls back to the source when the distributed cache is unusable', async () => {
    const broken = new CategoryCacheService({
      cache: Object.assign(new InMemoryCacheClient(), {
        get: async () => {
          throw new Error('redis down');
        },
        set: async () => {
          throw new Error('redis down');
        },
      }),
    });

    const categories = await broken.getCategories(fetcher);
    expect(categories.map((c) => c.id)).toEqual(['art', 'gaming', 'music']);
    expect(fetches).toBe(1);
    broken.close();
  });

  it('works with no distributed cache at all', async () => {
    const local = new CategoryCacheService({ cache: null });

    const categories = await local.getCategories(fetcher);
    expect(categories).toHaveLength(3);

    await local.invalidate();
    expect(local.getL1Size()).toBe(0);
    local.close();
  });
});
