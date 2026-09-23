import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  InMemoryCacheClient,
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { RedisReactionCacheAdapter } from '@vp/adapters/redis/redis-reaction-cache.adapter';
import type { QueueJob } from '@vp/core/ports';
import { PipelineEnvSchema, inProcessAppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { STAGE_REGISTRY, type StageDeps } from '../registry';

const CACHES = inProcessAppConfig().caches;

const STAGES = PipelineEnvSchema.shape.WORKER_STAGE.removeDefault().options;

/** The preStop sleep and the margin the process keeps before the kubelet's SIGKILL. */
const PRE_STOP_SECONDS = 5;
const MARGIN_SECONDS = 5;

function terminationGracePeriodSeconds(stage: string): number {
  const manifest = readFileSync(
    resolve(__dirname, `../../../../infra/k8s/base/worker-${stage}.yaml`),
    'utf8'
  );
  return Number(/terminationGracePeriodSeconds:\s*(\d+)/.exec(manifest)?.[1]);
}

function deps(): StageDeps {
  const storage = new InMemoryStorageClient();
  const getQueue = (name: string) => new InMemoryJobQueue(name);
  const cache = new InMemoryCacheClient();
  return {
    config: inProcessAppConfig(),
    repositories: new InMemoryRepositories(),
    storage,
    multipart: new InMemoryMultipartStorage(storage),
    cache,
    reactionCache: new RedisReactionCacheAdapter({
      ...CACHES.reactions,
      backend: { type: 'cache', cache },
    }),
    getQueue,
    flowProducer: new InMemoryFlowProducer(getQueue),
    logger: createLogger({ service: 'registry-test', level: 'silent' }),
    workerId: 'registry-test',
  };
}

describe('apps/worker: stage registry', () => {
  it('declares every stage the environment can name', () => {
    expect(Object.keys(STAGE_REGISTRY).sort()).toEqual([...STAGES].sort());
  });

  it.each(STAGES)('consumes a declared queue for %s and builds its processor', (stage) => {
    const definition = STAGE_REGISTRY[stage];

    expect(QUEUES).toContain(definition.queue);
    expect(definition.createProcessor(deps())).toBeTypeOf('function');
  });

  it('repairs a drifted reaction cache from the housekeeping stage', async () => {
    const d = deps();
    const videoId = '33333333-3333-7333-8333-333333333333';
    await d.repositories.videoReactions.setReaction(videoId, 'u1', 'LIKE');
    await d.reactionCache.setCounts(videoId, { likesCount: 7, dislikesCount: 0 });

    const processor = STAGE_REGISTRY.housekeeping.createProcessor(d);
    expectOk(
      await processor({
        id: 'reconcile-reactions',
        data: { task: 'reconcile-reaction-counters' },
      } as QueueJob<unknown>)
    );

    const cached = await d.reactionCache.getCounts(videoId, async () =>
      ok({ likesCount: 0, dislikesCount: 0 })
    );
    expect(expectOk(cached)).toEqual({ likesCount: 1, dislikesCount: 0 });
  });

  it.each(STAGES)(
    'lets %s give up before the kubelet kills it, and not a moment sooner',
    (stage) => {
      const graceSeconds = terminationGracePeriodSeconds(stage);

      expect(STAGE_REGISTRY[stage].shutdownTimeoutMs).toBe(
        (graceSeconds - PRE_STOP_SECONDS - MARGIN_SECONDS) * 1000
      );
    }
  );
});
