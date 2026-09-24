import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { ReactionCountsStore } from '../reaction-counts-store';
import { FakeRedis } from './fake-redis';

const VIDEO_ID = 'video-1';
const KEY = `taitube:video:${VIDEO_ID}:reactions`;
const COUNTS = { likesCount: 7, dislikesCount: 2 };

function overRedis(redis = new FakeRedis()): ReactionCountsStore {
  return new ReactionCountsStore({
    backend: { type: 'redis', redis: redis.asRedis() },
    ttlSeconds: 60,
  });
}

function overCache(cache = new InMemoryCacheClient()): ReactionCountsStore {
  return new ReactionCountsStore({ backend: { type: 'cache', cache }, ttlSeconds: 60 });
}

const BACKENDS = [
  { backend: 'a redis connection', open: () => overRedis() },
  { backend: 'a cache client', open: () => overCache() },
];

describe('ReactionCountsStore', () => {
  it.each(BACKENDS)('reads back what it wrote over $backend', async ({ open }) => {
    const store = open();
    expectOk(await store.write(VIDEO_ID, COUNTS, 12));

    expect(await store.read(VIDEO_ID)).toMatchObject(COUNTS);
  });

  it.each(BACKENDS)('reports an absent key as a miss over $backend', async ({ open }) => {
    expect(await open().read(VIDEO_ID)).toBeNull();
  });

  it.each(BACKENDS)('adjusts a present entry in place over $backend', async ({ open }) => {
    const store = open();
    await store.write(VIDEO_ID, COUNTS, 1);

    expectOk(await store.adjust(VIDEO_ID, 1, -1));

    expect(await store.read(VIDEO_ID)).toMatchObject({ likesCount: 8, dislikesCount: 1 });
  });

  it.each(BACKENDS)('leaves an absent entry absent over $backend', async ({ open }) => {
    const store = open();

    expectOk(await store.adjust(VIDEO_ID, 5, 0));

    expect(await store.read(VIDEO_ID)).toBeNull();
  });

  it.each(BACKENDS)('drops the entry on invalidate over $backend', async ({ open }) => {
    const store = open();
    await store.write(VIDEO_ID, COUNTS, 1);

    expectOk(await store.invalidate(VIDEO_ID));

    expect(await store.read(VIDEO_ID)).toBeNull();
  });

  describe('over a redis connection', () => {
    it('writes the counters as a hash with their freshness metadata and a ttl', async () => {
      const redis = new FakeRedis();

      expectOk(await overRedis(redis).write(VIDEO_ID, COUNTS, 12));

      const hash = redis.hashes.get(KEY);
      expect(hash?.get('likes')).toBe('7');
      expect(hash?.get('dislikes')).toBe('2');
      expect(hash?.get('delta')).toBe('12');
      expect(Number(hash?.get('cachedAt'))).toBeGreaterThan(0);
      expect(redis.ttls.get(KEY)).toBe(60);
    });

    it('reports a read that throws as a miss, so the caller asks its fetcher', async () => {
      const redis = Object.assign(new FakeRedis(), {
        hgetall: async () => {
          throw new Error('redis down');
        },
      });

      expect(await overRedis(redis).read(VIDEO_ID)).toBeNull();
    });

    it('reports a write that throws as CACHE_UNAVAILABLE', async () => {
      const redis = Object.assign(new FakeRedis(), {
        multi: () => {
          throw new Error('redis down');
        },
      });

      expect(expectErr(await overRedis(redis).write(VIDEO_ID, COUNTS, 1)).code).toBe(
        ErrorCodes.CACHE_UNAVAILABLE
      );
    });
  });

  describe('over a cache client', () => {
    it('reports unparseable JSON as a miss', async () => {
      const cache = new InMemoryCacheClient();
      await cache.set(KEY, 'not json', 60);

      expect(await overCache(cache).read(VIDEO_ID)).toBeNull();
    });

    it('serialises concurrent adjustments so none is lost', async () => {
      const store = overCache();
      await store.write(VIDEO_ID, { likesCount: 0, dislikesCount: 0 }, 1);

      await Promise.all(Array.from({ length: 20 }, () => store.adjust(VIDEO_ID, 1, 0)));

      expect(await store.read(VIDEO_ID)).toMatchObject({ likesCount: 20, dislikesCount: 0 });
    });

    it('never drives a counter below zero', async () => {
      const store = overCache();
      await store.write(VIDEO_ID, { likesCount: 1, dislikesCount: 0 }, 1);

      expectOk(await store.adjust(VIDEO_ID, -5, -5));

      expect(await store.read(VIDEO_ID)).toMatchObject({ likesCount: 0, dislikesCount: 0 });
    });
  });
});
