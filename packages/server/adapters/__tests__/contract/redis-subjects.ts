import { expectOk } from '@vp/testing/result';
import { RedisCacheClient } from '../../redis/redis-cache-client';
import type { CacheClientSubject } from './cache-client.contract';
import { inMemoryCacheClientSubject } from './in-memory-port-subjects';
import { claimRealServices } from './real-services';

/** The double in `unit` and under `bun test`; the Redis the integration run points at otherwise. */
export async function redisCacheClientSubject(): Promise<CacheClientSubject> {
  const services = claimRealServices();
  if (!services) return inMemoryCacheClientSubject();

  const cache = new RedisCacheClient({
    type: 'url',
    url: services.redis.url,
    pubsubUrl: services.redis.url,
    password: services.redis.password,
  });
  expectOk(await cache.checkHealth());
  return {
    cache,
    close: async () => {
      expectOk(await cache.close());
    },
  };
}
