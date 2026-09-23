import type { SubscriptionCachePort } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export class InMemorySubscriptionCache implements SubscriptionCachePort {
  private readonly userSubscriptions = new Map<string, Set<string>>();
  private readonly subscriberCounts = new Map<string, number>();

  async isSubscribed(
    userId: string,
    channelId: string
  ): Promise<Result<boolean | null, CacheUnavailable>> {
    return ok(this.userSubscriptions.get(userId)?.has(channelId) ?? null);
  }

  async addSubscription(
    userId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>> {
    const set = this.userSubscriptions.get(userId);
    if (set) {
      set.add(channelId);
      return ok();
    }
    this.userSubscriptions.set(userId, new Set([channelId]));
    return ok();
  }

  async removeSubscription(
    userId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>> {
    this.userSubscriptions.get(userId)?.delete(channelId);
    return ok();
  }

  async setUserSubscriptions(
    userId: string,
    channelIds: string[]
  ): Promise<Result<void, CacheUnavailable>> {
    this.userSubscriptions.set(userId, new Set(channelIds));
    return ok();
  }

  async getSubscriberCount(channelId: string): Promise<Result<number | null, CacheUnavailable>> {
    return ok(this.subscriberCounts.get(channelId) ?? null);
  }

  async setSubscriberCount(
    channelId: string,
    count: number
  ): Promise<Result<void, CacheUnavailable>> {
    this.subscriberCounts.set(channelId, count);
    return ok();
  }

  clear(): void {
    this.userSubscriptions.clear();
    this.subscriberCounts.clear();
  }
}
