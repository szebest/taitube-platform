import type { ReactionCounts } from '@vp/domain';
import { inProcessAppConfig } from '@vp/env-schema';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { RedisReactionCacheAdapter } from '../redis-reaction-cache.adapter';
import { FakeRedis } from './fake-redis';

const CACHES = inProcessAppConfig().caches;

const VIDEO_ID = 'video-1';
const USER_ID = 'user-1';
const VIDEO_KEY = `taitube:video:${VIDEO_ID}:reactions`;

const COUNTS: ReactionCounts = { likesCount: 7, dislikesCount: 2 };

describe('RedisReactionCacheAdapter', () => {
  describe('over a redis connection', () => {
    let redis: FakeRedis;
    let adapter: RedisReactionCacheAdapter;

    beforeEach(() => {
      redis = new FakeRedis();
      adapter = new RedisReactionCacheAdapter({
        ...CACHES.reactions,
        backend: { type: 'redis', redis: redis.asRedis() },
      });
    });

    afterEach(() => {
      adapter.clear();
    });

    it('fetches on a miss and serves the next read from the hash', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return ok(COUNTS);
      };

      expect(expectOk(await adapter.getCounts(VIDEO_ID, fetcher))).toEqual(COUNTS);
      expect(expectOk(await adapter.getCounts(VIDEO_ID, fetcher))).toEqual(COUNTS);
      expect(fetches).toBe(1);
      expect(redis.ttls.get(VIDEO_KEY)).toBe(3600);
    });

    it('collapses concurrent misses into a single fetch', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return ok(COUNTS);
      };

      const [a, b] = await Promise.all([
        adapter.getCounts(VIDEO_ID, fetcher),
        adapter.getCounts(VIDEO_ID, fetcher),
      ]);

      expect(expectOk(a)).toEqual(COUNTS);
      expect(expectOk(b)).toEqual(COUNTS);
      expect(fetches).toBe(1);
    });

    it('caches a user reaction and remembers a withdrawn one as NONE', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return ok('LIKE' as const);
      };

      expect(expectOk(await adapter.getUserReaction(USER_ID, VIDEO_ID, fetcher))).toBe('LIKE');
      expect(expectOk(await adapter.getUserReaction(USER_ID, VIDEO_ID, fetcher))).toBe('LIKE');
      expect(fetches).toBe(1);

      await adapter.setUserReaction(USER_ID, VIDEO_ID, null);
      expect(expectOk(await adapter.getUserReaction(USER_ID, VIDEO_ID, fetcher))).toBeNull();
      expect(fetches).toBe(1);
    });

    it('falls back to the source when the connection misbehaves', async () => {
      Object.assign(redis, {
        hgetall: async () => {
          throw new Error('redis down');
        },
      });

      expect(expectOk(await adapter.getCounts(VIDEO_ID, async () => ok(COUNTS)))).toEqual(COUNTS);
    });
  });

  describe('over a cache client', () => {
    let cache: InMemoryCacheClient;
    let adapter: RedisReactionCacheAdapter;

    beforeEach(() => {
      cache = new InMemoryCacheClient();
      adapter = new RedisReactionCacheAdapter({
        ...CACHES.reactions,
        backend: { type: 'cache', cache },
      });
    });

    afterEach(() => {
      adapter.clear();
    });

    it('round-trips the counters through the JSON fallback', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return ok(COUNTS);
      };

      expect(expectOk(await adapter.getCounts(VIDEO_ID, fetcher))).toEqual(COUNTS);
      expect(expectOk(await adapter.getCounts(VIDEO_ID, fetcher))).toEqual(COUNTS);
      expect(fetches).toBe(1);
    });

    it('keeps every adjustment and reaction written concurrently', async () => {
      await adapter.setCounts(VIDEO_ID, { likesCount: 0, dislikesCount: 0 });

      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          Promise.all([
            adapter.adjustCounters(VIDEO_ID, 1, 0),
            adapter.setUserReaction(`user-${i}`, VIDEO_ID, 'LIKE'),
          ])
        )
      );

      expect(expectOk(await adapter.getCounts(VIDEO_ID, async () => ok(COUNTS)))).toEqual({
        likesCount: 50,
        dislikesCount: 0,
      });
      expect(
        expectOk(await adapter.getUserReaction('user-49', VIDEO_ID, async () => ok(null)))
      ).toBe('LIKE');
    });

    it.each([
      { draw: 'unlucky', random: 1e-9, expected: 2 },
      { draw: 'lucky', random: 0.999999, expected: 1 },
    ])(
      'serves the cached entry and refreshes early only on an $draw draw',
      async ({ random, expected }) => {
        let fetches = 0;
        const fetcher = async () => {
          fetches += 1;
          return ok({ likesCount: 100 * fetches, dislikesCount: 5 });
        };
        await adapter.getCounts(VIDEO_ID, fetcher);
        const eager = new RedisReactionCacheAdapter({
          ...CACHES.reactions,
          backend: { type: 'cache', cache },
          ttlSeconds: 1,
          beta: 1000,
          random: () => random,
        });

        const served = expectOk(await eager.getCounts(VIDEO_ID, fetcher));

        expect(served).toEqual({ likesCount: 100, dislikesCount: 5 });
        expect(fetches).toBe(expected);
        eager.clear();
      }
    );

    it('caches the user reaction per video', async () => {
      await adapter.setUserReaction(USER_ID, VIDEO_ID, 'DISLIKE');

      expect(
        expectOk(
          await adapter.getUserReaction(USER_ID, VIDEO_ID, async () => {
            throw new Error('should not be reached');
          })
        )
      ).toBe('DISLIKE');
    });
  });
});
