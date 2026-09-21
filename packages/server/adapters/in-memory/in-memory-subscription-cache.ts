import type { SubscriptionCachePort } from '@vp/core/ports';

export class InMemorySubscriptionCache implements SubscriptionCachePort {
  private readonly userSubscriptions = new Map<string, Set<string>>();
  private readonly subscriberCounts = new Map<string, number>();

  async isSubscribed(userId: string, channelId: string): Promise<boolean | null> {
    return this.userSubscriptions.get(userId)?.has(channelId) ?? null;
  }

  async addSubscription(userId: string, channelId: string): Promise<void> {
    const set = this.userSubscriptions.get(userId);
    if (set) {
      set.add(channelId);
      return;
    }
    this.userSubscriptions.set(userId, new Set([channelId]));
  }

  async removeSubscription(userId: string, channelId: string): Promise<void> {
    this.userSubscriptions.get(userId)?.delete(channelId);
  }

  async setUserSubscriptions(userId: string, channelIds: string[]): Promise<void> {
    this.userSubscriptions.set(userId, new Set(channelIds));
  }

  async getSubscriberCount(channelId: string): Promise<number | null> {
    return this.subscriberCounts.get(channelId) ?? null;
  }

  async setSubscriberCount(channelId: string, count: number): Promise<void> {
    this.subscriberCounts.set(channelId, count);
  }

  clear(): void {
    this.userSubscriptions.clear();
    this.subscriberCounts.clear();
  }
}
