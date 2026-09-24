import type { SubscriptionCachePort } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { type Result, andThenAsync, fromPromise, map, ok } from '@vp/result';
import type { Redis } from 'ioredis';

export interface RedisSubscriptionCacheAdapterConfig {
  redis: Redis;
  userSubscriptionsTtlSeconds: number;
  subscriberCountTtlSeconds: number;
}

/**
 * A user with no subscriptions still needs a present key, otherwise every
 * lookup would read as a cache miss and fall through to Postgres.
 */
const EMPTY_SENTINEL = '__EMPTY__';

export class RedisSubscriptionCacheAdapter implements SubscriptionCachePort {
  private readonly redis: Redis;
  private readonly userSubscriptionsTtlSeconds: number;
  private readonly subscriberCountTtlSeconds: number;

  constructor(config: RedisSubscriptionCacheAdapterConfig) {
    this.redis = config.redis;
    this.userSubscriptionsTtlSeconds = config.userSubscriptionsTtlSeconds;
    this.subscriberCountTtlSeconds = config.subscriberCountTtlSeconds;
  }

  async isSubscribed(
    userId: string,
    channelId: string
  ): Promise<Result<boolean | null, CacheUnavailable>> {
    const key = CacheKeys.userSubscriptions(userId);

    const exists = await fromPromise(
      () => this.redis.exists(key),
      cacheUnavailable.during('isSubscribed')
    );

    return await andThenAsync(
      exists,
      async (present): Promise<Result<boolean | null, CacheUnavailable>> => {
        if (present === 0) return ok(null);
        const member = await fromPromise(
          () => this.redis.sismember(key, channelId),
          cacheUnavailable.during('isSubscribed')
        );
        return map(member, (hit) => hit === 1);
      }
    );
  }

  async addSubscription(
    userId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>> {
    const key = CacheKeys.userSubscriptions(userId);
    const done = await fromPromise(
      () =>
        this.redis
          .pipeline()
          .srem(key, EMPTY_SENTINEL)
          .sadd(key, channelId)
          .expire(key, this.userSubscriptionsTtlSeconds)
          .exec(),
      cacheUnavailable.during('addSubscription')
    );

    return map(done, () => undefined);
  }

  async removeSubscription(
    userId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>> {
    const done = await fromPromise(
      () => this.redis.srem(CacheKeys.userSubscriptions(userId), channelId),
      cacheUnavailable.during('removeSubscription')
    );

    return map(done, () => undefined);
  }

  async setUserSubscriptions(
    userId: string,
    channelIds: string[]
  ): Promise<Result<void, CacheUnavailable>> {
    const key = CacheKeys.userSubscriptions(userId);
    const done = await fromPromise(
      () =>
        this.redis
          .pipeline()
          .del(key)
          .sadd(key, ...(channelIds.length > 0 ? channelIds : [EMPTY_SENTINEL]))
          .expire(key, this.userSubscriptionsTtlSeconds)
          .exec(),
      cacheUnavailable.during('setUserSubscriptions')
    );

    return map(done, () => undefined);
  }

  async getSubscriberCount(channelId: string): Promise<Result<number | null, CacheUnavailable>> {
    const raw = await fromPromise(
      () => this.redis.get(CacheKeys.channelSubscriberCount(channelId)),
      cacheUnavailable.during('getSubscriberCount')
    );

    return map(raw, (value) => {
      if (value === null) return null;
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    });
  }

  async setSubscriberCount(
    channelId: string,
    count: number
  ): Promise<Result<void, CacheUnavailable>> {
    const done = await fromPromise(
      () =>
        this.redis.set(
          CacheKeys.channelSubscriberCount(channelId),
          String(count),
          'EX',
          this.subscriberCountTtlSeconds
        ),
      cacheUnavailable.during('setSubscriberCount')
    );

    return map(done, () => undefined);
  }
}
