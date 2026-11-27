import type { CacheUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';

/**
 * Caches the set of channels each subscribing channel follows, and per-channel subscriber counts.
 * Reads answer `ok(null)` on a miss, so a caller can fall back and prime; a dead cache is a
 * failure the caller may deliberately narrow away, which is what makes that fallback visible.
 */
export interface SubscriptionCachePort {
  isSubscribed(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<boolean | null, CacheUnavailable>>;
  addSubscription(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>>;
  removeSubscription(
    subscriberChannelId: string,
    channelId: string
  ): Promise<Result<void, CacheUnavailable>>;
  setSubscriptions(
    subscriberChannelId: string,
    channelIds: string[]
  ): Promise<Result<void, CacheUnavailable>>;
  getSubscriberCount(channelId: string): Promise<Result<number | null, CacheUnavailable>>;
  setSubscriberCount(channelId: string, count: number): Promise<Result<void, CacheUnavailable>>;
}
