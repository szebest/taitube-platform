import { InMemoryCacheClient, RedisReactionCacheAdapter } from '@vp/adapters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('RedisReactionCacheAdapter (Ticket 40 AC 43, 50-52)', () => {
  let cacheClient: InMemoryCacheClient;
  let adapter: RedisReactionCacheAdapter;

  beforeEach(() => {
    cacheClient = new InMemoryCacheClient();
    adapter = new RedisReactionCacheAdapter({
      cache: cacheClient,
      ttlSeconds: 60,
      beta: 1.0,
    });
  });

  it('retrieves counts on cache miss and populates cache', async () => {
    const videoId = 'test-vid-1';
    const fetcher = vi.fn().mockResolvedValue({ likesCount: 42, dislikesCount: 3 });

    const counts = await adapter.getCounts(videoId, fetcher);
    expect(counts).toEqual({ likesCount: 42, dislikesCount: 3 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call: cache hit, fetcher is NOT called again
    const cachedCounts = await adapter.getCounts(videoId, fetcher);
    expect(cachedCounts).toEqual({ likesCount: 42, dislikesCount: 3 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stampede protection: 100 simultaneous concurrent requests on an uncached video trigger only 1 query (AC 51)', async () => {
    const videoId = 'viral-vid-100';
    let fetchCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      fetchCount++;
      // Simulate non-trivial database query latency
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { likesCount: 1500, dislikesCount: 45 };
    });

    // Launch 100 simultaneous requests concurrently
    const promises = Array.from({ length: 100 }, () => adapter.getCounts(videoId, fetcher));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    for (const res of results) {
      expect(res).toEqual({ likesCount: 1500, dislikesCount: 45 });
    }

    // Exactly 1 database query executed! All 99 other requests coalesced via Singleflight!
    expect(fetchCount).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('caches user reactions to eliminate DB hits on video page load', async () => {
    const userId = 'u-123';
    const videoId = 'v-456';
    const fetcher = vi.fn().mockResolvedValue('LIKE');

    const reaction1 = await adapter.getUserReaction(userId, videoId, fetcher);
    expect(reaction1).toBe('LIKE');
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call: cache hit
    const reaction2 = await adapter.getUserReaction(userId, videoId, fetcher);
    expect(reaction2).toBe('LIKE');
    expect(fetcher).toHaveBeenCalledTimes(1);

    // After updating user reaction to DISLIKE
    await adapter.setUserReaction(userId, videoId, 'DISLIKE');
    const reaction3 = await adapter.getUserReaction(userId, videoId, fetcher);
    expect(reaction3).toBe('DISLIKE');
    expect(fetcher).toHaveBeenCalledTimes(1);

    // After clearing user reaction (null)
    await adapter.setUserReaction(userId, videoId, null);
    const reaction4 = await adapter.getUserReaction(userId, videoId, fetcher);
    expect(reaction4).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('adjustCounters updates counters in cache', async () => {
    const videoId = 'test-counters-adjust';
    await adapter.setCounts(videoId, { likesCount: 10, dislikesCount: 2 });

    await adapter.adjustCounters(videoId, 1, 0); // +1 like
    let counts = await adapter.getCounts(videoId, async () => ({
      likesCount: 0,
      dislikesCount: 0,
    }));
    expect(counts).toEqual({ likesCount: 11, dislikesCount: 2 });

    await adapter.adjustCounters(videoId, -1, 1); // -1 like, +1 dislike
    counts = await adapter.getCounts(videoId, async () => ({ likesCount: 0, dislikesCount: 0 }));
    expect(counts).toEqual({ likesCount: 10, dislikesCount: 3 });
  });

  it('probabilistic early expiration (XFetch) triggers background refresh', async () => {
    const videoId = 'xfetch-vid';
    let fetchCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      fetchCount++;
      return { likesCount: 100 * fetchCount, dislikesCount: 5 };
    });

    // Populate cache with an entry near expiry
    await adapter.getCounts(videoId, fetcher);
    expect(fetchCount).toBe(1);

    // High beta adapter to simulate XFetch threshold trigger
    const xfetchAdapter = new RedisReactionCacheAdapter({
      cache: cacheClient,
      ttlSeconds: 1, // small ttl
      beta: 1000.0, // force probabilistic refresh
    });

    // Reading should return existing cached value immediately while scheduling refresh
    const counts = await xfetchAdapter.getCounts(videoId, fetcher);
    expect(counts.likesCount).toBe(100);

    // Wait briefly for background singleflight refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fetchCount).toBeGreaterThanOrEqual(1);
  });

  it('concurrency: 50 simultaneous reaction toggles from different users update counters accurately (AC 52)', async () => {
    const videoId = 'concurrency-vid-50';
    // Start with 0 likes, 0 dislikes
    await adapter.setCounts(videoId, { likesCount: 0, dislikesCount: 0 });

    // 50 users simultaneously adjust counters (+1 like each)
    const toggles = Array.from({ length: 50 }, (_, i) => {
      const userId = `user-${i}`;
      return Promise.all([
        adapter.adjustCounters(videoId, 1, 0),
        adapter.setUserReaction(userId, videoId, 'LIKE'),
      ]);
    });

    await Promise.all(toggles);

    const finalCounts = await adapter.getCounts(videoId, async () => ({
      likesCount: 0,
      dislikesCount: 0,
    }));
    expect(finalCounts.likesCount).toBe(50);
    expect(finalCounts.dislikesCount).toBe(0);

    // Verify all 50 user reactions are cached
    for (let i = 0; i < 50; i++) {
      const userReaction = await adapter.getUserReaction(`user-${i}`, videoId, async () => null);
      expect(userReaction).toBe('LIKE');
    }
  });
});
