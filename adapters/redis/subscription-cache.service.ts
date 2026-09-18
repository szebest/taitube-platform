import type { SubscriptionCachePort } from '@vp/core/ports';
import type { Redis } from 'ioredis';

export interface SubscriptionCacheServiceConfig {
  redis?: Redis;
  userSubscriptionsTtlSeconds?: number; // default: 86400 (24 hours)
  subscriberCountTtlSeconds?: number; // default: 3600 (1 hour)
}

const EMPTY_SENTINEL = '__EMPTY__';

export class SubscriptionCacheService implements SubscriptionCachePort {
  private readonly redis?: Redis;
  private readonly userSubscriptionsTtlSeconds: number;
  private readonly subscriberCountTtlSeconds: number;

  // In-memory test double fallback when no Redis instance is provided
  private readonly memSets = new Map<string, Set<string>>();
  private readonly memCounts = new Map<string, number>();

  constructor(config: SubscriptionCacheServiceConfig = {}) {
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
    if (this.redis) {
      const key = this.userKey(userId);
      const exists = await this.redis.exists(key);
      if (exists === 0) {
        return null;
      }
      const member = await this.redis.sismember(key, channelId);
      return member === 1;
    }

    const set = this.memSets.get(userId);
    if (!set) {
      return null;
    }
    return set.has(channelId);
  }

  async addSubscription(userId: string, channelId: string): Promise<void> {
    if (this.redis) {
      const key = this.userKey(userId);
      await this.redis
        .pipeline()
        .srem(key, EMPTY_SENTINEL)
        .sadd(key, channelId)
        .expire(key, this.userSubscriptionsTtlSeconds)
        .exec();
      return;
    }

    let set = this.memSets.get(userId);
    if (!set) {
      set = new Set();
      this.memSets.set(userId, set);
    }
    set.add(channelId);
  }

  async removeSubscription(userId: string, channelId: string): Promise<void> {
    if (this.redis) {
      const key = this.userKey(userId);
      await this.redis.srem(key, channelId);
      return;
    }

    const set = this.memSets.get(userId);
    if (set) {
      set.delete(channelId);
    }
  }

  async setUserSubscriptions(userId: string, channelIds: string[]): Promise<void> {
    if (this.redis) {
      const key = this.userKey(userId);
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      if (channelIds.length > 0) {
        pipeline.sadd(key, ...channelIds);
      } else {
        pipeline.sadd(key, EMPTY_SENTINEL);
      }
      pipeline.expire(key, this.userSubscriptionsTtlSeconds);
      await pipeline.exec();
      return;
    }

    this.memSets.set(userId, new Set(channelIds));
  }

  async getSubscriberCount(channelId: string): Promise<number | null> {
    if (this.redis) {
      const key = this.channelCountKey(channelId);
      const val = await this.redis.get(key);
      if (val === null) {
        return null;
      }
      const parsed = Number.parseInt(val, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    const val = this.memCounts.get(channelId);
    return val !== undefined ? val : null;
  }

  async setSubscriberCount(channelId: string, count: number): Promise<void> {
    if (this.redis) {
      const key = this.channelCountKey(channelId);
      await this.redis.set(key, String(count), 'EX', this.subscriberCountTtlSeconds);
      return;
    }

    this.memCounts.set(channelId, count);
  }

  async incrementSubscriberCount(channelId: string, delta = 1): Promise<number | null> {
    if (this.redis) {
      const key = this.channelCountKey(channelId);
      const exists = await this.redis.exists(key);
      if (exists === 0) {
        return null;
      }
      return await this.redis.incrby(key, delta);
    }

    const val = this.memCounts.get(channelId);
    if (val === undefined) {
      return null;
    }
    const next = val + delta;
    this.memCounts.set(channelId, next);
    return next;
  }

  async decrementSubscriberCount(channelId: string, delta = 1): Promise<number | null> {
    if (this.redis) {
      const key = this.channelCountKey(channelId);
      const exists = await this.redis.exists(key);
      if (exists === 0) {
        return null;
      }
      const next = await this.redis.decrby(key, delta);
      if (next < 0) {
        await this.redis.set(key, '0', 'EX', this.subscriberCountTtlSeconds);
        return 0;
      }
      return next;
    }

    const val = this.memCounts.get(channelId);
    if (val === undefined) {
      return null;
    }
    const next = Math.max(0, val - delta);
    this.memCounts.set(channelId, next);
    return next;
  }

  clear(): void {
    this.memSets.clear();
    this.memCounts.clear();
  }
}
