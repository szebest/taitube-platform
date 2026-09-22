import { RedisSubscriptionCacheAdapter } from '../redis-subscription-cache.adapter';
import { expectOk } from '@vp/testing/result';
import { FakeRedis } from './fake-redis';

const USER_ID = 'user-1';
const CHANNEL_ID = 'channel-1';
const USER_KEY = `taitube:user:${USER_ID}:subscriptions`;
const COUNT_KEY = `taitube:channel:${CHANNEL_ID}:subscriber_count`;

describe('RedisSubscriptionCacheAdapter', () => {
  let redis: FakeRedis;
  let cache: RedisSubscriptionCacheAdapter;

  beforeEach(() => {
    redis = new FakeRedis();
    cache = new RedisSubscriptionCacheAdapter({ redis: redis.asRedis() });
  });

  describe('isSubscribed', () => {
    it('reports a miss as null rather than false', async () => {
      expect(expectOk(await cache.isSubscribed(USER_ID, CHANNEL_ID))).toBeNull();
    });

    it('answers from a warmed set', async () => {
      await cache.setUserSubscriptions(USER_ID, [CHANNEL_ID]);

      expect(expectOk(await cache.isSubscribed(USER_ID, CHANNEL_ID))).toBe(true);
      expect(expectOk(await cache.isSubscribed(USER_ID, 'other-channel'))).toBe(false);
    });

    it('keeps a subscription-free user cached rather than re-reading the database', async () => {
      await cache.setUserSubscriptions(USER_ID, []);

      expect(expectOk(await cache.isSubscribed(USER_ID, CHANNEL_ID))).toBe(false);
      expect(redis.sets.get(USER_KEY)?.size).toBe(1);
    });
  });

  describe('writes', () => {
    it('drops the empty marker when the first subscription arrives', async () => {
      await cache.setUserSubscriptions(USER_ID, []);
      await cache.addSubscription(USER_ID, CHANNEL_ID);

      expect([...(redis.sets.get(USER_KEY) ?? [])]).toEqual([CHANNEL_ID]);
      expect(redis.ttls.get(USER_KEY)).toBe(86400);
    });

    it('removes one channel without touching the rest', async () => {
      await cache.setUserSubscriptions(USER_ID, [CHANNEL_ID, 'channel-2']);
      await cache.removeSubscription(USER_ID, CHANNEL_ID);

      expect([...(redis.sets.get(USER_KEY) ?? [])]).toEqual(['channel-2']);
    });

    it('replaces the whole set on a refresh', async () => {
      await cache.setUserSubscriptions(USER_ID, [CHANNEL_ID]);
      await cache.setUserSubscriptions(USER_ID, ['channel-2', 'channel-3']);

      expect([...(redis.sets.get(USER_KEY) ?? [])].sort()).toEqual(['channel-2', 'channel-3']);
    });
  });

  describe('subscriber count', () => {
    it('reports a miss as null', async () => {
      expect(expectOk(await cache.getSubscriberCount(CHANNEL_ID))).toBeNull();
    });

    it('round-trips a count with its ttl', async () => {
      await cache.setSubscriberCount(CHANNEL_ID, 42);

      expect(expectOk(await cache.getSubscriberCount(CHANNEL_ID))).toBe(42);
      expect(redis.ttls.get(COUNT_KEY)).toBe(3600);
    });

    it('treats an unparseable count as a miss', async () => {
      redis.strings.set(COUNT_KEY, 'not-a-number');
      expect(expectOk(await cache.getSubscriberCount(CHANNEL_ID))).toBeNull();
    });
  });

  it('honours the configured ttls', async () => {
    const custom = new RedisSubscriptionCacheAdapter({
      redis: redis.asRedis(),
      userSubscriptionsTtlSeconds: 60,
      subscriberCountTtlSeconds: 30,
    });

    await custom.setUserSubscriptions(USER_ID, [CHANNEL_ID]);
    await custom.setSubscriberCount(CHANNEL_ID, 1);

    expect(redis.ttls.get(USER_KEY)).toBe(60);
    expect(redis.ttls.get(COUNT_KEY)).toBe(30);
  });
});
