import { inProcessAppConfig } from '@vp/env-schema';
import { CacheKeys } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { Redis } from 'ioredis';
import { FakeLiveRedis } from '../../redis/__tests__/fake-live-redis';
import { FakeRedis } from '../../redis/__tests__/fake-redis';
import { FakeWatchPartyRedis } from '../../redis/__tests__/fake-watch-party-redis';
import { RedisCacheClient } from '../../redis/redis-cache-client';
import { RedisCategoryCacheAdapter } from '../../redis/redis-category-cache.adapter';
import { RedisCommentSlowModeAdapter } from '../../redis/redis-comment-slow-mode.adapter';
import { RedisLiveChatGateAdapter } from '../../redis/redis-live-chat-gate.adapter';
import { RedisLivePresenceAdapter } from '../../redis/redis-live-presence.adapter';
import { RedisPartyGuestSessionsAdapter } from '../../redis/redis-party-guest-sessions.adapter';
import { RedisSearchSuggestionIndexAdapter } from '../../redis/redis-search-suggestion-index.adapter';
import { RedisSubscriptionCacheAdapter } from '../../redis/redis-subscription-cache.adapter';
import { RedisViewBufferAdapter } from '../../redis/redis-view-buffer.adapter';
import { RedisWatchPartyGateAdapter } from '../../redis/redis-watch-party-gate.adapter';
import { RedisWatchPartyPresenceAdapter } from '../../redis/redis-watch-party-presence.adapter';
import type { CacheClientSubject } from './cache-client.contract';
import type { CategoryCacheSubject } from './category-cache.contract';
import type { CommentSlowModeSubject } from './comment-slow-mode.contract';
import { inMemoryCacheClientSubject } from './in-memory-port-subjects';
import type { LiveChatGateSubject } from './live-chat-gate.contract';
import type { LivePresenceSubject } from './live-presence.contract';
import type { PartyGuestSessionsSubject } from './party-guest-sessions.contract';
import { claimRealServices } from './real-services';
import {
  CONTRACT_KEPT_PER_PREFIX,
  type SearchSuggestionIndexSubject,
} from './search-suggestion-index.contract';
import type { SubscriptionCacheSubject } from './subscription-cache.contract';
import type { ViewBufferSubject } from './view-buffer.contract';
import type { WatchPartyGateSubject } from './watch-party-gate.contract';
import type { WatchPartyPresenceSubject } from './watch-party-presence.contract';

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

function fakeOrRealRedis(fake: () => Redis = FakeLiveRedis.create): Redis {
  const services = claimRealServices();
  return services ? new Redis(services.redis.url, { password: services.redis.password }) : fake();
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
export async function redisCommentSlowModeSubject(): Promise<CommentSlowModeSubject> {
  const redis = fakeOrRealRedis();
  return {
    slowMode: new RedisCommentSlowModeAdapter(redis),
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

const WATCH_PARTY_STATE_TTL_SECONDS = 120;

/** The adapter over `FakeWatchPartyRedis` in `unit` and under `bun test`, over the real Redis otherwise. */
export async function redisWatchPartyGateSubject(): Promise<WatchPartyGateSubject> {
  const redis = fakeOrRealRedis(FakeWatchPartyRedis.create);
  return {
    gate: new RedisWatchPartyGateAdapter(redis, WATCH_PARTY_STATE_TTL_SECONDS),
    close: async () => {
      await redis.quit();
    },
  };
}

export async function redisWatchPartyPresenceSubject(): Promise<WatchPartyPresenceSubject> {
  const redis = fakeOrRealRedis(FakeWatchPartyRedis.create);
  return {
    presence: new RedisWatchPartyPresenceAdapter({
      redis,
      ttlSeconds: WATCH_PARTY_STATE_TTL_SECONDS,
    }),
    close: async () => {
      await redis.quit();
    },
  };
}

export async function redisPartyGuestSessionsSubject(): Promise<PartyGuestSessionsSubject> {
  const redis = fakeOrRealRedis(FakeWatchPartyRedis.create);
  return {
    sessions: new RedisPartyGuestSessionsAdapter(redis),
    close: async () => {
      await redis.quit();
    },
  };
}
