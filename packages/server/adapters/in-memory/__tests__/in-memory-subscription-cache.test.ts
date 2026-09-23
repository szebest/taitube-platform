import { expectOk } from '@vp/testing/result';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemorySubscriptionCache } from '../in-memory-subscription-cache';

describe('InMemorySubscriptionCache', () => {
  let cache: InMemorySubscriptionCache;
  const userId = '11111111-1111-7111-8111-111111111111';
  const channelId1 = '22222222-2222-7222-8222-222222222222';
  const channelId2 = '33333333-3333-7333-8333-333333333333';
  const unknownChannelId = '44444444-4444-7444-8444-444444444444';

  beforeEach(() => {
    cache = new InMemorySubscriptionCache();
  });

  describe('user subscription set', () => {
    it('returns null when the user has no cached set', async () => {
      expect(expectOk(await cache.isSubscribed(userId, channelId1))).toBeNull();
    });

    it('distinguishes a cached membership from a cached absence', async () => {
      await cache.addSubscription(userId, channelId1);

      expect(expectOk(await cache.isSubscribed(userId, channelId1))).toBe(true);
      expect(expectOk(await cache.isSubscribed(userId, channelId2))).toBe(false);
    });

    it('drops a membership on remove without invalidating the set', async () => {
      await cache.addSubscription(userId, channelId1);
      await cache.removeSubscription(userId, channelId1);

      expect(expectOk(await cache.isSubscribed(userId, channelId1))).toBe(false);
    });

    it('replaces the whole set when primed', async () => {
      await cache.addSubscription(userId, unknownChannelId);
      await cache.setUserSubscriptions(userId, [channelId1, channelId2]);

      expect(expectOk(await cache.isSubscribed(userId, channelId1))).toBe(true);
      expect(expectOk(await cache.isSubscribed(userId, channelId2))).toBe(true);
      expect(expectOk(await cache.isSubscribed(userId, unknownChannelId))).toBe(false);
    });

    it('treats a primed empty set as a hit, not a miss', async () => {
      await cache.setUserSubscriptions(userId, []);

      expect(expectOk(await cache.isSubscribed(userId, channelId1))).toBe(false);
    });
  });

  describe('channel subscriber count', () => {
    it('returns null when the count was never cached', async () => {
      expect(expectOk(await cache.getSubscriberCount(channelId1))).toBeNull();
    });

    it('round-trips a cached count', async () => {
      await cache.setSubscriberCount(channelId1, 42);

      expect(expectOk(await cache.getSubscriberCount(channelId1))).toBe(42);
    });

    it('caches zero as a value rather than a miss', async () => {
      await cache.setSubscriberCount(channelId1, 0);

      expect(expectOk(await cache.getSubscriberCount(channelId1))).toBe(0);
    });
  });

  it('clears both sets and counts', async () => {
    await cache.addSubscription(userId, channelId1);
    await cache.setSubscriberCount(channelId1, 5);

    cache.clear();

    expect(expectOk(await cache.isSubscribed(userId, channelId1))).toBeNull();
    expect(expectOk(await cache.getSubscriberCount(channelId1))).toBeNull();
  });
});
