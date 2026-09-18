import {
  InMemoryChannelRepository,
  InMemoryEventRepository,
  InMemoryOutboxRepository,
  InMemoryRenditionRepository,
  InMemoryStepRepository,
  InMemorySubscriptionRepository,
  InMemoryVideoRepository,
} from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Subscription Repository (Ticket 41)', () => {
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

    // Create creator channels
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

  describe('Subscription lifecycle & counts', () => {
    it('subscribes user and increments channel subscriber count', async () => {
      const res = await subRepo.subscribe(subscriber.userId, creator1.channelId);

      expect(res.subscribed).toBe(true);
      expect(res.subscriberCount).toBe(1);
      expect(res.isNew).toBe(true);

      const isSub = await subRepo.isSubscribed(subscriber.userId, creator1.channelId);
      expect(isSub).toBe(true);

      const count = await subRepo.getSubscriberCount(creator1.channelId);
      expect(count).toBe(1);
    });

    it('is idempotent: subscribing twice does not double-count', async () => {
      const res1 = await subRepo.subscribe(subscriber.userId, creator1.channelId);
      expect(res1.isNew).toBe(true);
      expect(res1.subscriberCount).toBe(1);

      const res2 = await subRepo.subscribe(subscriber.userId, creator1.channelId);
      expect(res2.isNew).toBe(false);
      expect(res2.subscriberCount).toBe(1);

      const count = await subRepo.getSubscriberCount(creator1.channelId);
      expect(count).toBe(1);
    });

    it('prevents self-subscription with CANNOT_SUBSCRIBE_TO_SELF error', async () => {
      await expect(
        subRepo.subscribe(creator1.userId, creator1.channelId)
      ).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
        })
      );
    });

    it('throws CHANNEL_NOT_FOUND when subscribing to non-existent channel', async () => {
      await expect(
        subRepo.subscribe(subscriber.userId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.CHANNEL_NOT_FOUND,
        })
      );
    });

    it('unsubscribes user and decrements channel subscriber count', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);

      const unsub = await subRepo.unsubscribe(subscriber.userId, creator1.channelId);
      expect(unsub.subscribed).toBe(false);
      expect(unsub.subscriberCount).toBe(0);
      expect(unsub.wasSubscribed).toBe(true);

      const isSub = await subRepo.isSubscribed(subscriber.userId, creator1.channelId);
      expect(isSub).toBe(false);
    });

    it('is idempotent: unsubscribing when not subscribed returns wasSubscribed: false', async () => {
      const unsub = await subRepo.unsubscribe(subscriber.userId, creator1.channelId);
      expect(unsub.subscribed).toBe(false);
      expect(unsub.subscriberCount).toBe(0);
      expect(unsub.wasSubscribed).toBe(false);
    });
  });

  describe('Listing subscriptions & feed', () => {
    it('lists channels user is subscribed to with pagination', async () => {
      await subRepo.subscribe(subscriber.userId, creator1.channelId);
      await subRepo.subscribe(subscriber.userId, creator2.channelId);

      const page1 = await subRepo.listUserSubscriptions(subscriber.userId, { limit: 1 });
      expect(page1.items).toHaveLength(1);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await subRepo.listUserSubscriptions(subscriber.userId, {
        limit: 1,
        cursor: page1.nextCursor
          ? JSON.parse(Buffer.from(page1.nextCursor, 'base64url').toString('utf8'))
          : undefined,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });

    it('returns public READY videos in subscription feed from subscribed channels only', async () => {
      // Creator 1 uploads 2 videos (1 public READY, 1 private)
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

      // Creator 2 uploads 1 public READY video
      const v3 = await videoRepo.create({
        id: '66666666-6666-7666-8666-666666666663',
        ownerId: creator2.userId,
        title: 'Creator 2 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/v3.mp4',
      });

      // User subscribes ONLY to creator 1
      await subRepo.subscribe(subscriber.userId, creator1.channelId);

      const feed = await subRepo.getSubscriptionFeed(subscriber.userId, { limit: 10 });
      expect(feed.total).toBe(1);
      expect(feed.items).toHaveLength(1);
      expect(feed.items[0]?.id).toBe(v1.id);
      expect(feed.items[0]?.title).toBe('Creator 1 Public Video');

      // Now user also subscribes to creator 2
      await subRepo.subscribe(subscriber.userId, creator2.channelId);

      const feed2 = await subRepo.getSubscriptionFeed(subscriber.userId, { limit: 10 });
      expect(feed2.total).toBe(2);
      expect(feed2.items.map((i) => i.id)).toContain(v1.id);
      expect(feed2.items.map((i) => i.id)).toContain(v3.id);
    });
  });
});
