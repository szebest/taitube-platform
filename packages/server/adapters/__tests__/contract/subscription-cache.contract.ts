import { randomUUID } from 'node:crypto';
import type { SubscriptionCachePort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface SubscriptionCacheSubject {
  readonly cache: SubscriptionCachePort;
  close(): Promise<void>;
}

export type MakeSubscriptionCacheSubject = () => Promise<SubscriptionCacheSubject>;

export function describeSubscriptionCacheContract(makeSubject: MakeSubscriptionCacheSubject): void {
  describe('SubscriptionCache contract', () => {
    let subject: SubscriptionCacheSubject;
    let cache: SubscriptionCachePort;
    let userId: string;
    let channelId: string;
    let otherChannelId: string;

    beforeAll(async () => {
      subject = await makeSubject();
      cache = subject.cache;
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      userId = randomUUID();
      channelId = randomUUID();
      otherChannelId = randomUUID();
    });

    const isSubscribed = async (channel: string) =>
      expectOk(await cache.isSubscribed(userId, channel));

    it('answers null, a miss, for a user whose set was never primed', async () => {
      expect(await isSubscribed(channelId)).toBeNull();
    });

    it('answers a primed set, and false for a channel outside it', async () => {
      expectOk(await cache.setUserSubscriptions(userId, [channelId]));

      expect(await isSubscribed(channelId)).toBe(true);
      expect(await isSubscribed(otherChannelId)).toBe(false);
    });

    it('keeps a primed empty set as a hit, not a miss', async () => {
      expectOk(await cache.setUserSubscriptions(userId, []));

      expect(await isSubscribed(channelId)).toBe(false);
    });

    it('replaces the whole set when primed again', async () => {
      expectOk(await cache.setUserSubscriptions(userId, [otherChannelId]));
      expectOk(await cache.setUserSubscriptions(userId, [channelId]));

      expect(await isSubscribed(channelId)).toBe(true);
      expect(await isSubscribed(otherChannelId)).toBe(false);
    });

    it('adds a channel to a primed empty set', async () => {
      expectOk(await cache.setUserSubscriptions(userId, []));
      expectOk(await cache.addSubscription(userId, channelId));

      expect(await isSubscribed(channelId)).toBe(true);
      expect(await isSubscribed(otherChannelId)).toBe(false);
    });

    it('removes one channel and keeps the rest', async () => {
      expectOk(await cache.setUserSubscriptions(userId, [channelId, otherChannelId]));
      expectOk(await cache.removeSubscription(userId, channelId));

      expect(await isSubscribed(channelId)).toBe(false);
      expect(await isSubscribed(otherChannelId)).toBe(true);
    });

    it('answers a miss once the last channel is removed, as Redis drops an empty set', async () => {
      expectOk(await cache.setUserSubscriptions(userId, [channelId]));
      expectOk(await cache.removeSubscription(userId, channelId));

      expect(await isSubscribed(channelId)).toBeNull();
    });

    it('leaves a user whose set was never primed a miss after a removal', async () => {
      expectOk(await cache.removeSubscription(userId, channelId));

      expect(await isSubscribed(channelId)).toBeNull();
    });

    it.each([42, 0])('round-trips a subscriber count of %i', async (count) => {
      expectOk(await cache.setSubscriberCount(channelId, count));

      expect(expectOk(await cache.getSubscriberCount(channelId))).toBe(count);
    });

    it('answers null for a subscriber count never cached', async () => {
      expect(expectOk(await cache.getSubscriberCount(channelId))).toBeNull();
    });
  });
}
