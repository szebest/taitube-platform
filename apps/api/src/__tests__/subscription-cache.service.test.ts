import { SubscriptionCacheService } from '@vp/adapters';
import { beforeEach, describe, expect, it } from 'vitest';

describe('SubscriptionCacheService (Ticket 41)', () => {
  let cache: SubscriptionCacheService;
  const userId = '11111111-1111-7111-8111-111111111111';
  const channelId1 = '22222222-2222-7222-8222-222222222222';
  const channelId2 = '33333333-3333-7333-8333-333333333333';

  beforeEach(() => {
    cache = new SubscriptionCacheService();
  });

  describe('User subscription set caching', () => {
    it('returns null on cache miss', async () => {
      const result = await cache.isSubscribed(userId, channelId1);
      expect(result).toBeNull();
    });

    it('adds subscription and returns true on isSubscribed check', async () => {
      await cache.addSubscription(userId, channelId1);

      expect(await cache.isSubscribed(userId, channelId1)).toBe(true);
      expect(await cache.isSubscribed(userId, channelId2)).toBe(false);
    });

    it('removes subscription and reflects in isSubscribed', async () => {
      await cache.addSubscription(userId, channelId1);
      expect(await cache.isSubscribed(userId, channelId1)).toBe(true);

      await cache.removeSubscription(userId, channelId1);
      expect(await cache.isSubscribed(userId, channelId1)).toBe(false);
    });

    it('primes full user subscriptions with setUserSubscriptions', async () => {
      await cache.setUserSubscriptions(userId, [channelId1, channelId2]);

      expect(await cache.isSubscribed(userId, channelId1)).toBe(true);
      expect(await cache.isSubscribed(userId, channelId2)).toBe(true);
      expect(await cache.isSubscribed(userId, '44444444-4444-7444-8444-444444444444')).toBe(false);
    });

    it('handles empty user subscriptions array correctly', async () => {
      await cache.setUserSubscriptions(userId, []);

      // Cache hit for empty set returns false
      expect(await cache.isSubscribed(userId, channelId1)).toBe(false);
    });
  });

  describe('Channel subscriber count caching', () => {
    it('returns null on cache miss', async () => {
      const count = await cache.getSubscriberCount(channelId1);
      expect(count).toBeNull();
    });

    it('sets and gets subscriber count', async () => {
      await cache.setSubscriberCount(channelId1, 42);
      expect(await cache.getSubscriberCount(channelId1)).toBe(42);
    });

    it('increments subscriber count when present', async () => {
      await cache.setSubscriberCount(channelId1, 10);
      const updated = await cache.incrementSubscriberCount(channelId1, 1);
      expect(updated).toBe(11);
      expect(await cache.getSubscriberCount(channelId1)).toBe(11);
    });

    it('decrements subscriber count and clamps to 0', async () => {
      await cache.setSubscriberCount(channelId1, 1);
      const dec1 = await cache.decrementSubscriberCount(channelId1, 1);
      expect(dec1).toBe(0);

      const dec2 = await cache.decrementSubscriberCount(channelId1, 1);
      expect(dec2).toBe(0);
    });
  });

  describe('clear', () => {
    it('clears all cached data', async () => {
      await cache.addSubscription(userId, channelId1);
      await cache.setSubscriberCount(channelId1, 5);

      cache.clear();

      expect(await cache.isSubscribed(userId, channelId1)).toBeNull();
      expect(await cache.getSubscriberCount(channelId1)).toBeNull();
    });
  });
});
