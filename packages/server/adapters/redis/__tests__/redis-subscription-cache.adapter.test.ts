import { expectOk } from '@kit/testing/result';
import { inProcessAppConfig } from '@vp/env-schema';
import { redisSubscriptionCacheSubject } from '../../__tests__/contract/redis-subjects';
import { describeSubscriptionCacheContract } from '../../__tests__/contract/subscription-cache.contract';
import { RedisSubscriptionCacheAdapter } from '../redis-subscription-cache.adapter';
import { FakeRedis } from './fake-redis';

const CACHES = inProcessAppConfig().caches;

const SUBSCRIBER_CHANNEL_ID = 'subscriber-channel-1';
const CHANNEL_ID = 'channel-1';
const FOLLOWED_KEY = `taitube:channel:${SUBSCRIBER_CHANNEL_ID}:subscriptions`;
const COUNT_KEY = `taitube:channel:${CHANNEL_ID}:subscriber_count`;

describe('RedisSubscriptionCacheAdapter', () => {
  let redis: FakeRedis;
  let cache: RedisSubscriptionCacheAdapter;

  beforeEach(() => {
    redis = new FakeRedis();
    cache = new RedisSubscriptionCacheAdapter({ ...CACHES.subscriptions, redis: redis.asRedis() });
  });

  describe('isSubscribed', () => {
    it('keeps a channel that follows nobody cached rather than re-reading the database', async () => {
      await cache.setSubscriptions(SUBSCRIBER_CHANNEL_ID, []);

      expect(expectOk(await cache.isSubscribed(SUBSCRIBER_CHANNEL_ID, CHANNEL_ID))).toBe(false);
      expect(redis.sets.get(FOLLOWED_KEY)?.size).toBe(1);
    });
  });

  describe('writes', () => {
    it('drops the empty marker when the first subscription arrives', async () => {
      await cache.setSubscriptions(SUBSCRIBER_CHANNEL_ID, []);
      await cache.addSubscription(SUBSCRIBER_CHANNEL_ID, CHANNEL_ID);

      expect([...(redis.sets.get(FOLLOWED_KEY) ?? [])]).toEqual([CHANNEL_ID]);
      expect(redis.ttls.get(FOLLOWED_KEY)).toBe(86400);
    });

    it('removes one channel without touching the rest', async () => {
      await cache.setSubscriptions(SUBSCRIBER_CHANNEL_ID, [CHANNEL_ID, 'channel-2']);
      await cache.removeSubscription(SUBSCRIBER_CHANNEL_ID, CHANNEL_ID);

      expect([...(redis.sets.get(FOLLOWED_KEY) ?? [])]).toEqual(['channel-2']);
    });

    it('replaces the whole set on a refresh', async () => {
      await cache.setSubscriptions(SUBSCRIBER_CHANNEL_ID, [CHANNEL_ID]);
      await cache.setSubscriptions(SUBSCRIBER_CHANNEL_ID, ['channel-2', 'channel-3']);

      expect([...(redis.sets.get(FOLLOWED_KEY) ?? [])].sort()).toEqual(['channel-2', 'channel-3']);
    });
  });

  describe('subscriber count', () => {
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
      ...CACHES.subscriptions,
      redis: redis.asRedis(),
      userSubscriptionsTtlSeconds: 60,
      subscriberCountTtlSeconds: 30,
    });

    await custom.setSubscriptions(SUBSCRIBER_CHANNEL_ID, [CHANNEL_ID]);
    await custom.setSubscriberCount(CHANNEL_ID, 1);

    expect(redis.ttls.get(FOLLOWED_KEY)).toBe(60);
    expect(redis.ttls.get(COUNT_KEY)).toBe(30);
  });
});

describeSubscriptionCacheContract(redisSubscriptionCacheSubject);
