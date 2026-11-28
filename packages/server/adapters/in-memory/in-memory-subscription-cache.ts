import type { CacheUnavailable } from '@kit/errors';
import { type Result, ok } from '@kit/result';
import type { SubscriptionCachePort } from '@vp/core/ports';

export class InMemorySubscriptionCache implements SubscriptionCachePort {
  private readonly followed = new Map<string, Set<string>>();
  private readonly subscriberCounts = new Map<string, number>();

  async isSubscribed(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<boolean | null, CacheUnavailable>> {
    return ok(this.followed.get(subscriberChannelId)?.has(channelId) ?? null);
  }

  async addSubscription(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>> {
    const set = this.followed.get(subscriberChannelId);
    if (set) {
      set.add(channelId);
      return ok();
    }
    this.followed.set(subscriberChannelId, new Set([channelId]));
    return ok();
  }

  async removeSubscription(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>> {
    const set = this.followed.get(subscriberChannelId);
    set?.delete(channelId);
    if (set?.size === 0) this.followed.delete(subscriberChannelId);
    return ok();
  }

  async setSubscriptions(
    subscriberChannelId: string,
    channelIds: string[]
  ): Promise<Result<void, CacheUnavailable>> {
    this.followed.set(subscriberChannelId, new Set(channelIds));
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
    this.followed.clear();
    this.subscriberCounts.clear();
  }
}
