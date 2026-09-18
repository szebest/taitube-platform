import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
  RedisReactionCacheAdapter,
} from '@vp/adapters';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createHousekeepingProcessor,
  runReconcileReactionCounters,
} from '../stages/housekeeping';

describe('Scheduled Reaction Counter Drift Reconciler (Ticket 40 AC 48-49)', () => {
  let repos: InMemoryRepositories;
  let cacheClient: InMemoryCacheClient;
  let reactionCache: RedisReactionCacheAdapter;

  beforeEach(() => {
    repos = new InMemoryRepositories();
    cacheClient = new InMemoryCacheClient();
    reactionCache = new RedisReactionCacheAdapter({
      cache: cacheClient,
    });
  });

  it('detects and repairs drift between ground truth video_reactions and counters', async () => {
    const videoId = '11111111-1111-7111-8111-111111111111';

    // 1. User 1 likes, User 2 likes, User 3 dislikes
    await repos.videoReactions.setReaction(videoId, 'u1', 'LIKE');
    await repos.videoReactions.setReaction(videoId, 'u2', 'LIKE');
    await repos.videoReactions.setReaction(videoId, 'u3', 'DISLIKE');

    // Ground truth: 2 likes, 1 dislike
    const groundTruth = await repos.videoReactions.countGroundTruth(videoId);
    expect(groundTruth).toEqual({ likesCount: 2, dislikesCount: 1 });

    // 2. Simulate drift: artificially corrupt the denormalized counters in DB
    await repos.videoReactions.updateVideoCounters(videoId, 999, 999);
    expect(await repos.videoReactions.getReactionCounts(videoId)).toEqual({
      likesCount: 999,
      dislikesCount: 999,
    });

    // Also simulate stale Redis cache
    await reactionCache.setCounts(videoId, { likesCount: 999, dislikesCount: 999 });

    // 3. Run reconciler
    const result = await runReconcileReactionCounters({
      repositories: repos,
      reactionCache,
    });

    expect(result.checkedCount).toBe(1);
    expect(result.repairedCount).toBe(1);

    // 4. Verify denormalized counters in DB were repaired
    const repairedDbCounts = await repos.videoReactions.getReactionCounts(videoId);
    expect(repairedDbCounts).toEqual({ likesCount: 2, dislikesCount: 1 });

    // 5. Verify Redis cache was synchronized
    const repairedCacheCounts = await reactionCache.getCounts(videoId, async () => ({
      likesCount: 0,
      dislikesCount: 0,
    }));
    expect(repairedCacheCounts).toEqual({ likesCount: 2, dislikesCount: 1 });

    // 6. Running reconciler again with no drift repairs 0
    const secondRun = await runReconcileReactionCounters({
      repositories: repos,
      reactionCache,
    });
    expect(secondRun.checkedCount).toBe(1);
    expect(secondRun.repairedCount).toBe(0);
  });

  it('createHousekeepingProcessor executes reconcile-reaction-counters task', async () => {
    const storage = new InMemoryStorageClient();
    const processor = createHousekeepingProcessor({
      repositories: repos,
      storage,
      reactionCache,
    });

    const videoId = '22222222-2222-7222-8222-222222222222';
    await repos.videoReactions.setReaction(videoId, 'u1', 'LIKE');
    await repos.videoReactions.updateVideoCounters(videoId, 0, 0); // corrupt

    const res = (await processor({
      id: 'job-reconcile-test',
      data: { task: 'reconcile-reaction-counters' },
    } as unknown as Parameters<typeof processor>[0])) as {
      checkedCount: number;
      repairedCount: number;
    };

    expect(res.checkedCount).toBe(1);
    expect(res.repairedCount).toBe(1);
    expect(await repos.videoReactions.getReactionCounts(videoId)).toEqual({
      likesCount: 1,
      dislikesCount: 0,
    });
  });
});
