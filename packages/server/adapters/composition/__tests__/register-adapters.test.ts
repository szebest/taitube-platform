import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { CaslAuthorizationAdapter } from '../../authorization/casl-authorization-adapter';
import { InMemoryCacheClient } from '../../in-memory/in-memory-cache-client';
import { InMemoryRepositories } from '../../in-memory/repositories/in-memory-repositories';
import { PostgresRepositories } from '../../postgres/repositories/postgres-repositories';
import { RedisCacheClient } from '../../redis/redis-cache-client';
import { RedisCategoryCacheAdapter } from '../../redis/redis-category-cache.adapter';
import { RedisCommentCacheAdapter } from '../../redis/redis-comment-cache.adapter';
import { Adapters } from '../adapter-tokens';
import { registerAdapters } from '../register-adapters';

const external = { ...inProcessAppConfig(), kind: 'external' as const };

describe('registerAdapters', () => {
  it('registers the in-memory family for the in-memory kind', async () => {
    const c = await registerAdapters(new Container(), inProcessAppConfig());

    expect(c.get(Adapters.Repositories)).toBeInstanceOf(InMemoryRepositories);
    expect(c.get(Adapters.Cache)).toBeInstanceOf(InMemoryCacheClient);
    expectOk(await c.dispose());
  });

  it('registers the external family for the external kind', async () => {
    const c = await registerAdapters(new Container(), external);

    expect(c.get(Adapters.Repositories)).toBeInstanceOf(PostgresRepositories);
    expect(c.get(Adapters.Cache)).toBeInstanceOf(RedisCacheClient);
    await c.dispose();
  });

  it('decides the family from the configuration, never from an override', async () => {
    const c = await registerAdapters(new Container(), external);
    c.override(Adapters.Cache, new InMemoryCacheClient());

    expect(c.get(Adapters.Repositories)).toBeInstanceOf(PostgresRepositories);
    await c.dispose();
  });

  it('opens one queue per declared stage and points the probe queue at its own', async () => {
    const c = await registerAdapters(new Container(), inProcessAppConfig());
    const queues = c.get(Adapters.Queues);

    expect([...queues.keys()]).toEqual([...QUEUES]);
    expect(c.get(Adapters.ProbeQueue)).toBe(queues.get('probe'));
    expectOk(await c.dispose());
  });

  it('shares the family-neutral adapters across both kinds', async () => {
    const c = await registerAdapters(new Container(), inProcessAppConfig());

    expect(c.get(Adapters.Authorization)).toBeInstanceOf(CaslAuthorizationAdapter);
    expect(c.get(Adapters.CategoryCache)).toBeInstanceOf(RedisCategoryCacheAdapter);
    expect(c.get(Adapters.CommentCache)).toBeInstanceOf(RedisCommentCacheAdapter);
    expectOk(await c.dispose());
  });

  it('subscribes the category cache on start, not on construction', async () => {
    const c = await registerAdapters(new Container(), inProcessAppConfig());
    const cache = c.get(Adapters.Cache) as InMemoryCacheClient;
    const subscribe = vi.spyOn(cache, 'subscribe');
    c.get(Adapters.CategoryCache);

    expect(subscribe).not.toHaveBeenCalled();
    expectOk(await c.start());
    expect(subscribe).toHaveBeenCalledTimes(1);
    expectOk(await c.dispose());
  });
});
