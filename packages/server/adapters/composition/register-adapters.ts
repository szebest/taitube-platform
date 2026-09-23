import type { Container } from '@vp/composition';
import type { JobQueue } from '@vp/core/ports';
import type { AppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import { CaslAuthorizationAdapter } from '../authorization/casl-authorization-adapter';
import { RedisCategoryCacheAdapter } from '../redis/redis-category-cache.adapter';
import { RedisReactionCacheAdapter } from '../redis/redis-reaction-cache.adapter';
import { Adapters } from './adapter-tokens';

/**
 * The only place the platform chooses between the in-memory and the external adapter family.
 * The family is imported on demand, so an external process never loads a test double.
 */
export async function registerAdapters(c: Container, config: AppConfig): Promise<Container> {
  const family =
    config.kind === 'in-memory'
      ? await import('./in-memory-family')
      : await import('./external-family');

  family.registerFamily(c.provide(Adapters.Config, () => config));

  return c
    .provide(Adapters.Queues, (c) => {
      const registry = c.get(Adapters.QueueRegistry);
      return new Map<string, JobQueue>(QUEUES.map((name) => [name, registry.get(name)]));
    })
    .provide(Adapters.ProbeQueue, (c) => c.get(Adapters.Queues).get('probe'))
    .provide(Adapters.Authorization, () => new CaslAuthorizationAdapter())
    .provide(
      Adapters.ReactionCache,
      (c) => new RedisReactionCacheAdapter({ cache: c.get(Adapters.Cache) })
    )
    .provide(
      Adapters.CategoryCache,
      (c) => new RedisCategoryCacheAdapter({ cache: c.get(Adapters.Cache) }),
      {
        start: (cache) => cache.start(),
        dispose: (cache) => cache.close(),
      }
    );
}
