import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { ReactionCountsStore } from '../reaction-counts-store';
import { FakeRedis } from './fake-redis';

const VIDEO_ID = 'video-1';
const KEY = `taitube:video:${VIDEO_ID}:reactions`;
const COUNTS = { likesCount: 7, dislikesCount: 2 };

describe('ReactionCountsStore', () => {
  describe('over a redis connection', () => {
    let redis: FakeRedis;
    let store: ReactionCountsStore;

    beforeEach(() => {
      redis = new FakeRedis();
      store = new ReactionCountsStore({
        backend: { type: 'redis', redis: redis.asRedis() },
        ttlSeconds: 60,
      });
    });

    it('writes the counters with their freshness metadata and a ttl', async () => {
      expectOk(await store.write(VIDEO_ID, COUNTS, 12));

      const hash = redis.hashes.get(KEY);
      expect(hash?.get('likes')).toBe('7');
      expect(hash?.get('dislikes')).toBe('2');
      expect(hash?.get('delta')).toBe('12');
      expect(redis.ttls.get(KEY)).toBe(60);
    });

    it('reads back what it wrote', async () => {
      await store.write(VIDEO_ID, COUNTS, 12);

      expect(await store.read(VIDEO_ID)).toMatchObject(COUNTS);
    });

    it('reports an absent key as a miss rather than a zeroed entry', async () => {
      expect(await store.read(VIDEO_ID)).toBeNull();
    });

    it('reports a read that throws as a miss, so the caller asks its fetcher', async () => {
      Object.assign(redis, {
        hgetall: async () => {
          throw new Error('redis down');
        },
      });

      expect(await store.read(VIDEO_ID)).toBeNull();
    });

    it('reports a write that throws as CACHE_UNAVAILABLE', async () => {
      Object.assign(redis, {
        multi: () => {
          throw new Error('redis down');
        },
      });

      expect(expectErr(await store.write(VIDEO_ID, COUNTS, 1)).code).toBe(
        ErrorCodes.CACHE_UNAVAILABLE
      );
    });

    it('adjusts a present entry in place', async () => {
      await store.write(VIDEO_ID, COUNTS, 1);
      expectOk(await store.adjust(VIDEO_ID, 1, -1));

      expect(await store.read(VIDEO_ID)).toMatchObject({ likesCount: 8, dislikesCount: 1 });
    });

    it('leaves an absent entry absent rather than inventing a counter', async () => {
      expectOk(await store.adjust(VIDEO_ID, 5, 0));

      expect(redis.hashes.has(KEY)).toBe(false);
    });

    it('drops the entry on invalidate', async () => {
      await store.write(VIDEO_ID, COUNTS, 1);
      expectOk(await store.invalidate(VIDEO_ID));

      expect(redis.hashes.has(KEY)).toBe(false);
    });
  });

  describe('over a cache client', () => {
    let cache: InMemoryCacheClient;
    let store: ReactionCountsStore;

    beforeEach(() => {
      cache = new InMemoryCacheClient();
      store = new ReactionCountsStore({ backend: { type: 'cache', cache }, ttlSeconds: 60 });
    });

    afterEach(() => {
      store.clear();
    });

    it('round-trips the counters through JSON', async () => {
      expectOk(await store.write(VIDEO_ID, COUNTS, 12));

      expect(await store.read(VIDEO_ID)).toMatchObject(COUNTS);
    });

    it('reports unparseable JSON as a miss', async () => {
      await cache.set(KEY, 'not json', 60);

      expect(await store.read(VIDEO_ID)).toBeNull();
    });

    it('serialises concurrent adjustments so none is lost', async () => {
      await store.write(VIDEO_ID, { likesCount: 0, dislikesCount: 0 }, 1);

      await Promise.all(Array.from({ length: 20 }, () => store.adjust(VIDEO_ID, 1, 0)));

      expect(await store.read(VIDEO_ID)).toMatchObject({ likesCount: 20, dislikesCount: 0 });
    });

    it('never drives a counter below zero', async () => {
      await store.write(VIDEO_ID, { likesCount: 1, dislikesCount: 0 }, 1);
      expectOk(await store.adjust(VIDEO_ID, -5, -5));

      expect(await store.read(VIDEO_ID)).toMatchObject({ likesCount: 0, dislikesCount: 0 });
    });

    it('drops the entry on invalidate', async () => {
      await store.write(VIDEO_ID, COUNTS, 1);
      expectOk(await store.invalidate(VIDEO_ID));

      expect(expectOk(await cache.get(KEY))).toBeNull();
    });
  });
});
