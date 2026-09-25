import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { Redis } from 'ioredis';
import { FakeRedis } from '../../redis/__tests__/fake-redis';
import { RedisCacheClient } from '../../redis/redis-cache-client';
import { RedisCategoryCacheAdapter } from '../../redis/redis-category-cache.adapter';
import { RedisSubscriptionCacheAdapter } from '../../redis/redis-subscription-cache.adapter';
import { RedisViewBufferAdapter } from '../../redis/redis-view-buffer.adapter';
import type { CacheClientSubject } from './cache-client.contract';
import type { CategoryCacheSubject } from './category-cache.contract';
import { inMemoryCacheClientSubject } from './in-memory-port-subjects';
import { claimRealServices } from './real-services';
import type { SubscriptionCacheSubject } from './subscription-cache.contract';
import type { ViewBufferSubject } from './view-buffer.contract';

const CACHES = inProcessAppConfig().caches;

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

/** The adapter over whichever cache client `redisCacheClientSubject` hands out. */
export async function redisCategoryCacheSubject(): Promise<CategoryCacheSubject> {
  const client = await redisCacheClientSubject();
  const cache = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache: client.cache });
  return {
    cache,
    close: async () => {
      await cache.close();
      await client.close();
    },
  };
}

/** The adapter over `FakeRedis` in `unit` and under `bun test`, over the real Redis otherwise. */
export async function redisSubscriptionCacheSubject(): Promise<SubscriptionCacheSubject> {
  const services = claimRealServices();
  const redis = services
    ? new Redis(services.redis.url, { password: services.redis.password })
    : new FakeRedis().asRedis();
  return {
    cache: new RedisSubscriptionCacheAdapter({ ...CACHES.subscriptions, redis }),
    close: async () => {
      await redis.quit();
    },
  };
}

/** The adapter over `FakeRedis` in `unit` and under `bun test`, over the real Redis otherwise. */
export async function redisViewBufferSubject(): Promise<ViewBufferSubject> {
  const services = claimRealServices();
  const redis = services
    ? new Redis(services.redis.url, { password: services.redis.password })
    : new FakeRedis().asRedis();
  return {
    buffer: new RedisViewBufferAdapter({
      redis,
      dedupTtlSeconds: inProcessAppConfig().views.dedupTtlSeconds,
    }),
    close: async () => {
      await redis.quit();
    },
  };
}
