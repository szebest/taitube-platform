/**
 * Caches a user's subscribed-channel set and per-channel subscriber counts.
 * Reads return null on a miss so callers can fall back and prime.
 */
export interface SubscriptionCachePort {
  isSubscribed(userId: string, channelId: string): Promise<boolean | null>;
  addSubscription(userId: string, channelId: string): Promise<void>;
  removeSubscription(userId: string, channelId: string): Promise<void>;
  setUserSubscriptions(userId: string, channelIds: string[]): Promise<void>;
  getSubscriberCount(channelId: string): Promise<number | null>;
  setSubscriberCount(channelId: string, count: number): Promise<void>;
}
