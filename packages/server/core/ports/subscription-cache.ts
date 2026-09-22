import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Caches a user's subscribed-channel set and per-channel subscriber counts.
 * Reads answer `ok(null)` on a miss, so a caller can fall back and prime; a dead cache is a
 * failure the caller may deliberately narrow away, which is what makes that fallback visible.
 */
export interface SubscriptionCachePort {
  isSubscribed(
    userId: string,
    channelId: string
  ): Promise<Result<boolean | null, CacheUnavailable>>;
  addSubscription(userId: string, channelId: string): Promise<Result<void, CacheUnavailable>>;
  removeSubscription(userId: string, channelId: string): Promise<Result<void, CacheUnavailable>>;
  setUserSubscriptions(
    userId: string,
    channelIds: string[]
  ): Promise<Result<void, CacheUnavailable>>;
  getSubscriberCount(channelId: string): Promise<Result<number | null, CacheUnavailable>>;
  setSubscriberCount(channelId: string, count: number): Promise<Result<void, CacheUnavailable>>;
}
