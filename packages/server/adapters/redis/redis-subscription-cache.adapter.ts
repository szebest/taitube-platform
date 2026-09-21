import type { SubscriptionCachePort } from '@vp/core/ports';
import type { Redis } from 'ioredis';

export interface RedisSubscriptionCacheAdapterConfig {
  redis: Redis;
  userSubscriptionsTtlSeconds?: number;
  subscriberCountTtlSeconds?: number;
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
    this.userSubscriptionsTtlSeconds = config.userSubscriptionsTtlSeconds ?? 86400;
    this.subscriberCountTtlSeconds = config.subscriberCountTtlSeconds ?? 3600;
  }

  private userKey(userId: string): string {
    return `taitube:user:${userId}:subscriptions`;
  }

  private channelCountKey(channelId: string): string {
    return `taitube:channel:${channelId}:subscriber_count`;
  }

  async isSubscribed(userId: string, channelId: string): Promise<boolean | null> {
    const key = this.userKey(userId);
    if ((await this.redis.exists(key)) === 0) return null;
    return (await this.redis.sismember(key, channelId)) === 1;
  }

  async addSubscription(userId: string, channelId: string): Promise<void> {
    const key = this.userKey(userId);
    await this.redis
      .pipeline()
      .srem(key, EMPTY_SENTINEL)
      .sadd(key, channelId)
      .expire(key, this.userSubscriptionsTtlSeconds)
      .exec();
  }

  async removeSubscription(userId: string, channelId: string): Promise<void> {
    await this.redis.srem(this.userKey(userId), channelId);
  }

  async setUserSubscriptions(userId: string, channelIds: string[]): Promise<void> {
    const key = this.userKey(userId);
    await this.redis
      .pipeline()
      .del(key)
      .sadd(key, ...(channelIds.length > 0 ? channelIds : [EMPTY_SENTINEL]))
      .expire(key, this.userSubscriptionsTtlSeconds)
      .exec();
  }

  async getSubscriberCount(channelId: string): Promise<number | null> {
    const raw = await this.redis.get(this.channelCountKey(channelId));
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async setSubscriberCount(channelId: string, count: number): Promise<void> {
    await this.redis.set(
      this.channelCountKey(channelId),
      String(count),
      'EX',
      this.subscriberCountTtlSeconds
    );
  }
}
