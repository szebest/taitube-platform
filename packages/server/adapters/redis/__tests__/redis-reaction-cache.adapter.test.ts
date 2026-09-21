import type { ReactionCounts } from '@vp/domain';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { RedisReactionCacheAdapter } from '../redis-reaction-cache.adapter';
import { FakeRedis } from './fake-redis';

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
      adapter = new RedisReactionCacheAdapter({ redis: redis.asRedis() });
    });

    afterEach(() => {
      adapter.clear();
    });

    it('fetches on a miss and serves the next read from the hash', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return COUNTS;
      };

      expect(await adapter.getCounts(VIDEO_ID, fetcher)).toEqual(COUNTS);
      expect(await adapter.getCounts(VIDEO_ID, fetcher)).toEqual(COUNTS);
      expect(fetches).toBe(1);
      expect(redis.ttls.get(VIDEO_KEY)).toBe(3600);
    });

    it('collapses concurrent misses into a single fetch', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return COUNTS;
      };

      const [a, b] = await Promise.all([
        adapter.getCounts(VIDEO_ID, fetcher),
        adapter.getCounts(VIDEO_ID, fetcher),
      ]);

      expect(a).toEqual(COUNTS);
      expect(b).toEqual(COUNTS);
      expect(fetches).toBe(1);
    });

    it('writes the counters alongside the freshness metadata', async () => {
      await adapter.setCounts(VIDEO_ID, COUNTS);

      const hash = redis.hashes.get(VIDEO_KEY);
      expect(hash?.get('likes')).toBe('7');
      expect(hash?.get('dislikes')).toBe('2');
      expect(Number(hash?.get('cachedAt'))).toBeGreaterThan(0);
    });

    it('adjusts a cached entry in place', async () => {
      await adapter.setCounts(VIDEO_ID, COUNTS);
      await adapter.adjustCounters(VIDEO_ID, 1, -1);

      expect(await adapter.getCounts(VIDEO_ID, async () => COUNTS)).toEqual({
        likesCount: 8,
        dislikesCount: 1,
      });
    });

    it('leaves an uncached video alone rather than inventing a counter', async () => {
      await adapter.adjustCounters(VIDEO_ID, 5, 0);
      expect(redis.hashes.has(VIDEO_KEY)).toBe(false);
    });

    it('drops the entry on invalidate', async () => {
      await adapter.setCounts(VIDEO_ID, COUNTS);
      await adapter.invalidate(VIDEO_ID);

      expect(redis.hashes.has(VIDEO_KEY)).toBe(false);
    });

    it('caches a user reaction and remembers a withdrawn one as NONE', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return 'LIKE' as const;
      };

      expect(await adapter.getUserReaction(USER_ID, VIDEO_ID, fetcher)).toBe('LIKE');
      expect(await adapter.getUserReaction(USER_ID, VIDEO_ID, fetcher)).toBe('LIKE');
      expect(fetches).toBe(1);

      await adapter.setUserReaction(USER_ID, VIDEO_ID, null);
      expect(await adapter.getUserReaction(USER_ID, VIDEO_ID, fetcher)).toBeNull();
      expect(fetches).toBe(1);
    });

    it('falls back to the source when the connection misbehaves', async () => {
      Object.assign(redis, {
        hgetall: async () => {
          throw new Error('redis down');
        },
      });

      expect(await adapter.getCounts(VIDEO_ID, async () => COUNTS)).toEqual(COUNTS);
    });
  });

  describe('over a cache client', () => {
    let cache: InMemoryCacheClient;
    let adapter: RedisReactionCacheAdapter;

    beforeEach(() => {
      cache = new InMemoryCacheClient();
      adapter = new RedisReactionCacheAdapter({ cache });
    });

    afterEach(() => {
      adapter.clear();
    });

    it('round-trips the counters through the JSON fallback', async () => {
      let fetches = 0;
      const fetcher = async () => {
        fetches += 1;
        return COUNTS;
      };

      expect(await adapter.getCounts(VIDEO_ID, fetcher)).toEqual(COUNTS);
      expect(await adapter.getCounts(VIDEO_ID, fetcher)).toEqual(COUNTS);
      expect(fetches).toBe(1);
    });

    it('serialises concurrent adjustments so none is lost', async () => {
      await adapter.setCounts(VIDEO_ID, { likesCount: 0, dislikesCount: 0 });

      await Promise.all([
        adapter.adjustCounters(VIDEO_ID, 1, 0),
        adapter.adjustCounters(VIDEO_ID, 1, 0),
        adapter.adjustCounters(VIDEO_ID, 1, 0),
      ]);

      expect(await adapter.getCounts(VIDEO_ID, async () => COUNTS)).toEqual({
        likesCount: 3,
        dislikesCount: 0,
      });
    });

    it('never drives a counter below zero', async () => {
      await adapter.setCounts(VIDEO_ID, { likesCount: 1, dislikesCount: 0 });
      await adapter.adjustCounters(VIDEO_ID, -5, -5);

      expect(await adapter.getCounts(VIDEO_ID, async () => COUNTS)).toEqual({
        likesCount: 0,
        dislikesCount: 0,
      });
    });

    it('caches the user reaction per video', async () => {
      await adapter.setUserReaction(USER_ID, VIDEO_ID, 'DISLIKE');

      expect(
        await adapter.getUserReaction(USER_ID, VIDEO_ID, async () => {
          throw new Error('should not be reached');
        })
      ).toBe('DISLIKE');
    });

    it('drops the entry on invalidate', async () => {
      await adapter.setCounts(VIDEO_ID, COUNTS);
      await adapter.invalidate(VIDEO_ID);

      expect(await cache.get(VIDEO_KEY)).toBeNull();
    });
  });

  it('serves reads straight from the source when no cache is wired up', async () => {
    const adapter = new RedisReactionCacheAdapter();
    let fetches = 0;

    expect(
      await adapter.getCounts(VIDEO_ID, async () => {
        fetches += 1;
        return COUNTS;
      })
    ).toEqual(COUNTS);
    expect(fetches).toBe(1);
  });
});
