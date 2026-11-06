import { inProcessAppConfig } from '@vp/env-schema';
import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { Redis } from 'ioredis';
import { FakeLiveRedis } from '../../redis/__tests__/fake-live-redis';
import { FakeRedis } from '../../redis/__tests__/fake-redis';
import { RedisCacheClient } from '../../redis/redis-cache-client';
import { RedisCategoryCacheAdapter } from '../../redis/redis-category-cache.adapter';
import { RedisLiveChatGateAdapter } from '../../redis/redis-live-chat-gate.adapter';
import { RedisLivePresenceAdapter } from '../../redis/redis-live-presence.adapter';
import { RedisSearchSuggestionIndexAdapter } from '../../redis/redis-search-suggestion-index.adapter';
import { RedisSubscriptionCacheAdapter } from '../../redis/redis-subscription-cache.adapter';
import { RedisViewBufferAdapter } from '../../redis/redis-view-buffer.adapter';
import type { CacheClientSubject } from './cache-client.contract';
import type { CategoryCacheSubject } from './category-cache.contract';
import { inMemoryCacheClientSubject } from './in-memory-port-subjects';
import type { LiveChatGateSubject } from './live-chat-gate.contract';
import type { LivePresenceSubject } from './live-presence.contract';
import { claimRealServices } from './real-services';
import {
  CONTRACT_KEPT_PER_PREFIX,
  type SearchSuggestionIndexSubject,
} from './search-suggestion-index.contract';
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

/** The adapter over `FakeRedis` in `unit` and under `bun test`, over the real Redis otherwise. */
export async function redisSearchSuggestionIndexSubject(): Promise<SearchSuggestionIndexSubject> {
  const services = claimRealServices();
  const redis = services
    ? new Redis(services.redis.url, { password: services.redis.password })
    : new FakeRedis().asRedis();
  return {
    index: new RedisSearchSuggestionIndexAdapter({
      redis,
      keptPerPrefix: CONTRACT_KEPT_PER_PREFIX,
    }),
    endWindow: async (text) => {
      await redis.del(CacheKeys.searchCounted(text));
    },
    close: async () => {
      await redis.quit();
    },
  };
}

function fakeOrRealRedis(): Redis {
  const services = claimRealServices();
  return services
    ? new Redis(services.redis.url, { password: services.redis.password })
    : FakeLiveRedis.create();
}

/** The adapter over `FakeRedis` in `unit` and under `bun test`, over the real Redis otherwise. */
export async function redisLiveChatGateSubject(): Promise<LiveChatGateSubject> {
  const redis = fakeOrRealRedis();
  return {
    gate: new RedisLiveChatGateAdapter(redis),
    close: async () => {
      await redis.quit();
    },
  };
}

/** The adapter over `FakeRedis` in `unit` and under `bun test`, over the real Redis otherwise. */
export async function redisLivePresenceSubject(): Promise<LivePresenceSubject> {
  const redis = fakeOrRealRedis();
  return {
    presence: new RedisLivePresenceAdapter({ redis, ttlSeconds: 120 }),
    close: async () => {
      await redis.quit();
    },
  };
}
