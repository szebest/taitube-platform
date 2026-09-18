export interface SubscriptionCachePort {
  /**
   * Returns true/false if cached in Redis set (O(1) SISMEMBER).
   * Returns null on cache miss so caller can fetch and prime the set.
   */
  isSubscribed(userId: string, channelId: string): Promise<boolean | null>;

  /**
   * Adds channelId to user's Redis subscription set (SADD).
   */
  addSubscription(userId: string, channelId: string): Promise<void>;

  /**
   * Removes channelId from user's Redis subscription set (SREM).
   */
  removeSubscription(userId: string, channelId: string): Promise<void>;

  /**
   * Replaces user's cached subscription set with the full list of channel IDs.
   */
  setUserSubscriptions(userId: string, channelIds: string[]): Promise<void>;

  /**
   * Reads cached subscriber count if present. Returns null on cache miss.
   */
  getSubscriberCount(channelId: string): Promise<number | null>;

  /**
   * Caches subscriber count with TTL.
   */
  setSubscriberCount(channelId: string, count: number): Promise<void>;

  /**
   * Atomically increments cached subscriber count (INCRBY).
   */
  incrementSubscriberCount(channelId: string, delta?: number): Promise<number | null>;

  /**
   * Atomically decrements cached subscriber count (DECRBY), clamped to >= 0.
   */
  decrementSubscriberCount(channelId: string, delta?: number): Promise<number | null>;

  /**
   * Clears internal cache state (test doubles).
   */
  clear?(): Promise<void> | void;
}
