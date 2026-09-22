import { ErrorCodes } from '@vp/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryChannelRepository } from '../in-memory-channel-repository';
import { InMemoryEventRepository } from '../in-memory-event-repository';
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository';
import { InMemoryRenditionRepository } from '../in-memory-rendition-repository';
import { InMemoryStepRepository } from '../in-memory-step-repository';
import { InMemorySubscriptionRepository } from '../in-memory-subscription-repository';
import { InMemoryVideoRepository } from '../in-memory-video-repository';

describe('InMemorySubscriptionRepository', () => {
  let channelRepo: InMemoryChannelRepository;
  let videoRepo: InMemoryVideoRepository;
  let subRepo: InMemorySubscriptionRepository;

  const creator1 = {
    userId: '11111111-1111-7111-8111-111111111111',
    channelId: '22222222-2222-7222-8222-222222222222',
  };

  const creator2 = {
    userId: '33333333-3333-7333-8333-333333333333',
    channelId: '44444444-4444-7444-8444-444444444444',
  };

  const subscriber = {
    userId: '55555555-5555-7555-8555-555555555555',
  };

  beforeEach(async () => {
    channelRepo = new InMemoryChannelRepository();
    const events = new InMemoryEventRepository();
    const outbox = new InMemoryOutboxRepository();
    const renditions = new InMemoryRenditionRepository();
    const steps = new InMemoryStepRepository();

    videoRepo = new InMemoryVideoRepository({
      eventsRepo: events,
      outboxRepo: outbox,
      renditionsRepo: renditions,
      stepsRepo: steps,
    });

    subRepo = new InMemorySubscriptionRepository({
      channelsRepo: channelRepo,
      videosRepo: videoRepo,
    });

    await channelRepo.create({
      id: creator1.channelId,
      userId: creator1.userId,
      handle: 'creator_one',
      displayName: 'Creator One',
    });

    await channelRepo.create({
      id: creator2.channelId,
      userId: creator2.userId,
      handle: 'creator_two',
      displayName: 'Creator Two',
    });
  });

  describe('subscription lifecycle & counts', () => {
    it('subscribes and increments the channel subscriber count', async () => {
      const res = await subRepo.subscribe(subscriber.userId, creator1.channelId);

      expect(res).toEqual({ subscriberCount: 1, changed: true });
      expect(await subRepo.isSubscribed(subscriber.userId, creator1.channelId)).toBe(true);
      expect(await subRepo.getSubscriberCount(creator1.channelId)).toBe(1);
    });

    it('is idempotent: subscribing twice does not double-count', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);
      const second = await subRepo.subscribe(subscriber.userId, creator1.channelId);

      expect(second).toEqual({ subscriberCount: 1, changed: false });
      expect(await subRepo.getSubscriberCount(creator1.channelId)).toBe(1);
    });

    it('unsubscribes and decrements the channel subscriber count', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);

      const unsub = await subRepo.unsubscribe(subscriber.userId, creator1.channelId);

      expect(unsub).toEqual({ subscriberCount: 0, changed: true });
      expect(await subRepo.isSubscribed(subscriber.userId, creator1.channelId)).toBe(false);
    });

    it('is idempotent: unsubscribing when not subscribed is a no-op', async () => {
      const unsub = await subRepo.unsubscribe(subscriber.userId, creator1.channelId);

      expect(unsub).toEqual({ subscriberCount: 0, changed: false });
    });

    it.each([
      {
        scenario: 'subscribing to your own channel',
        act: () => subRepo.subscribe(creator1.userId, creator1.channelId),
        code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
      },
      {
        scenario: 'subscribing to a channel that does not exist',
        act: () => subRepo.subscribe(subscriber.userId, '00000000-0000-0000-0000-000000000000'),
        code: ErrorCodes.CHANNEL_NOT_FOUND,
      },
      {
        scenario: 'unsubscribing from a channel that does not exist',
        act: () => subRepo.unsubscribe(subscriber.userId, '00000000-0000-0000-0000-000000000000'),
        code: ErrorCodes.CHANNEL_NOT_FOUND,
      },
    ])('rejects $scenario', async ({ act, code }) => {
      await expect(act()).rejects.toThrowError(expect.objectContaining({ code }));
    });
  });

  describe('listing subscriptions & feed', () => {
    it('returns limit + 1 rows so the caller can detect a further page', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);
      await subRepo.subscribe(subscriber.userId, creator2.channelId);

      const rows = await subRepo.listUserSubscriptions(subscriber.userId, { limit: 1 });

      expect(rows).toHaveLength(2);
    });

    it('walks pages without repeating or skipping a channel', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);
      await subRepo.subscribe(subscriber.userId, creator2.channelId);

      const [first] = await subRepo.listUserSubscriptions(subscriber.userId, { limit: 1 });
      if (!first) throw new Error('expected a first page');

      const next = await subRepo.listUserSubscriptions(subscriber.userId, {
        limit: 1,
        cursor: { createdAt: first.subscribedAt, channelId: first.id },
      });

      expect(next).toHaveLength(1);
      expect(next[0]?.id).not.toBe(first.id);
    });

    it('exposes the channel profile alongside the subscription timestamp', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);

      const [row] = await subRepo.listUserSubscriptions(subscriber.userId, { limit: 10 });

      expect(row).toMatchObject({
        id: creator1.channelId,
        userId: creator1.userId,
        handle: 'creator_one',
        displayName: 'Creator One',
        subscriberCount: 1,
      });
      expect(row?.subscribedAt).toBeInstanceOf(Date);
    });

    it('returns public READY videos in subscription feed from subscribed channels only', async () => {
      const v1 = await videoRepo.create({
        id: '66666666-6666-7666-8666-666666666661',
        ownerId: creator1.userId,
        title: 'Creator 1 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/v1.mp4',
      });
      await videoRepo.create({
        id: '66666666-6666-7666-8666-666666666662',
        ownerId: creator1.userId,
        title: 'Creator 1 Private Video',
        visibility: 'private',
        status: 'READY',
        sourceKey: 'raw/v2.mp4',
      });

      const v3 = await videoRepo.create({
        id: '66666666-6666-7666-8666-666666666663',
        ownerId: creator2.userId,
        title: 'Creator 2 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/v3.mp4',
      });

      await subRepo.subscribe(subscriber.userId, creator1.channelId);

      const feed = await subRepo.getSubscriptionFeed(subscriber.userId, { limit: 10 });
      expect(feed.total).toBe(1);
      expect(feed.items).toHaveLength(1);
      expect(feed.items[0]?.id).toBe(v1.id);
      expect(feed.items[0]?.title).toBe('Creator 1 Public Video');

      await subRepo.subscribe(subscriber.userId, creator2.channelId);

      const feed2 = await subRepo.getSubscriptionFeed(subscriber.userId, { limit: 10 });
      expect(feed2.total).toBe(2);
      expect(feed2.items.map((i) => i.id)).toContain(v1.id);
      expect(feed2.items.map((i) => i.id)).toContain(v3.id);
    });
  });
});
