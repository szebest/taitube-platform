import {
  InMemoryCacheClient,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import { inProcessAppConfig } from '@vp/env-schema';
import type { HousekeepingJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { createHousekeepingProcessor } from '../index';
import { inMemoryQueues } from './housekeeping-harness';

describe('housekeeping: createHousekeepingProcessor', () => {
  let repositories: InMemoryRepositories;

  const run = async (task: HousekeepingJob['task']) => {
    const storage = new InMemoryStorageClient();
    const processor = createHousekeepingProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      multipart: new InMemoryMultipartStorage(storage),
      reactionCache: new RedisReactionCacheAdapter({
        ...inProcessAppConfig().caches.reactions,
        backend: { type: 'cache', cache: new InMemoryCacheClient() },
      }),
      getQueue: inMemoryQueues(),
    });
    return expectOk(await processor({ id: `job-${task}`, name: task, data: { task } }));
  };

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  it('dispatches reconcile-uploads to the upload reconciler', async () => {
    expect(await run('reconcile-uploads')).toEqual({ abandonedCount: 0, reenqueuedCount: 0 });
  });

  it('dispatches reconcile-reaction-counters to the counter reconciler', async () => {
    const videoId = '22222222-2222-7222-8222-222222222222';
    await repositories.videoReactions.setReaction(videoId, 'u1', 'LIKE');
    await repositories.videoReactions.updateVideoCounters(videoId, 0, 0);

    expect(await run('reconcile-reaction-counters')).toEqual({ checkedCount: 1, repairedCount: 1 });
    expect(expectOk(await repositories.videoReactions.getReactionCounts(videoId))).toEqual({
      likesCount: 1,
      dislikesCount: 0,
    });
  });
});
