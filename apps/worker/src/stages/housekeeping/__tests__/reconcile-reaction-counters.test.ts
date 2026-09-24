import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import { inProcessAppConfig } from '@vp/env-schema';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { runReconcileReactionCounters } from '../reconcile-reaction-counters';

const config = inProcessAppConfig();

describe('housekeeping: reconcile-reaction-counters', () => {
  let repositories: InMemoryRepositories;
  let reactionCache: RedisReactionCacheAdapter;

  const reconcile = async () =>
    expectOk(
      await runReconcileReactionCounters({
        repositories,
        reactionCache,
        limit: config.housekeeping.reactionReconcileLimit,
      })
    );

  const cachedCounts = async (videoId: string) =>
    expectOk(
      await reactionCache.getCounts(videoId, async () => ok({ likesCount: 0, dislikesCount: 0 }))
    );

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    reactionCache = new RedisReactionCacheAdapter({
      ...config.caches.reactions,
      backend: { type: 'cache', cache: new InMemoryCacheClient() },
    });
  });

  it('repairs drifted database counters and the cache from the reactions themselves', async () => {
    const videoId = '11111111-1111-7111-8111-111111111111';
    await repositories.videoReactions.setReaction(videoId, 'u1', 'LIKE');
    await repositories.videoReactions.setReaction(videoId, 'u2', 'LIKE');
    await repositories.videoReactions.setReaction(videoId, 'u3', 'DISLIKE');
    expect(expectOk(await repositories.videoReactions.countGroundTruth(videoId))).toEqual({
      likesCount: 2,
      dislikesCount: 1,
    });

    await repositories.videoReactions.updateVideoCounters(videoId, 999, 999);
    expect(expectOk(await repositories.videoReactions.getReactionCounts(videoId))).toEqual({
      likesCount: 999,
      dislikesCount: 999,
    });
    await reactionCache.setCounts(videoId, { likesCount: 999, dislikesCount: 999 });

    expect(await reconcile()).toEqual({ checkedCount: 1, repairedCount: 1 });

    const truth = { likesCount: 2, dislikesCount: 1 };
    expect(expectOk(await repositories.videoReactions.getReactionCounts(videoId))).toEqual(truth);
    expect(await cachedCounts(videoId)).toEqual(truth);
    expect(await reconcile()).toEqual({ checkedCount: 1, repairedCount: 0 });
  });

  it('repairs a stale cache when the database counters are already right', async () => {
    const videoId = '33333333-3333-7333-8333-333333333333';
    await repositories.videoReactions.setReaction(videoId, 'u1', 'LIKE');
    await reactionCache.setCounts(videoId, { likesCount: 0, dislikesCount: 0 });

    expect(await reconcile()).toEqual({ checkedCount: 1, repairedCount: 1 });
    expect(await cachedCounts(videoId)).toEqual({ likesCount: 1, dislikesCount: 0 });
  });
});
