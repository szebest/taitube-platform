import {
  InMemoryChannelRepository,
  InMemoryEventRepository,
  InMemoryOutboxRepository,
  InMemoryRenditionRepository,
  InMemoryStepRepository,
  InMemorySubscriptionCache,
  InMemorySubscriptionRepository,
  InMemoryVideoRepository,
} from '@vp/adapters/in-memory';
import { ErrorCodes, cacheUnavailable } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { SubscriptionService } from '../subscription-service';
import { TEST_CDN } from './service-deps';

describe('SubscriptionService', () => {
  let channels: InMemoryChannelRepository;
  let videos: InMemoryVideoRepository;
  let subscriptions: InMemorySubscriptionRepository;
  let cache: InMemorySubscriptionCache;
  let service: SubscriptionService;

  const creator = {
    userId: '11111111-1111-7111-8111-111111111111',
    channelId: '22222222-2222-7222-8222-222222222222',
  };
  const otherCreator = {
    userId: '33333333-3333-7333-8333-333333333333',
    channelId: '44444444-4444-7444-8444-444444444444',
  };
  const subscriber: UserContext = {
    id: '55555555-5555-7555-8555-555555555555',
    email: 'subscriber@example.com',
    role: 'USER',
  };
  const missingChannelId = '00000000-0000-0000-0000-000000000000';

  beforeEach(async () => {
    channels = new InMemoryChannelRepository();
    videos = new InMemoryVideoRepository({
      eventsRepo: new InMemoryEventRepository(),
      outboxRepo: new InMemoryOutboxRepository(),
      renditionsRepo: new InMemoryRenditionRepository(),
      stepsRepo: new InMemoryStepRepository(),
    });
    subscriptions = new InMemorySubscriptionRepository({
      channelsRepo: channels,
      videosRepo: videos,
    });
    cache = new InMemorySubscriptionCache();
    service = new SubscriptionService({
      subscriptions,
      channels,
      subscriptionCache: cache,
      cdn: TEST_CDN,
      paginator: new Paginator(),
    });

    await channels.create({
      id: creator.channelId,
      userId: creator.userId,
      handle: 'creator_one',
      displayName: 'Creator One',
    });
    await channels.create({
      id: otherCreator.channelId,
      userId: otherCreator.userId,
      handle: 'creator_two',
      displayName: 'Creator Two',
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('reports the new state and count', async () => {
      const result = expectOk(await service.subscribe(subscriber, creator.channelId));

      expect(result).toEqual({
        channelId: creator.channelId,
        subscribed: true,
        subscriberCount: 1,
      });
    });

    it('primes the cache so the next status check needs no query', async () => {
      await service.subscribe(subscriber, creator.channelId);

      expect(expectOk(await cache.isSubscribed(subscriber.id, creator.channelId))).toBe(true);
      expect(expectOk(await cache.getSubscriberCount(creator.channelId))).toBe(1);
    });

    it('leaves the cache a miss once the only membership is unsubscribed', async () => {
      await service.subscribe(subscriber, creator.channelId);
      const result = expectOk(await service.unsubscribe(subscriber, creator.channelId));

      expect(result).toEqual({
        channelId: creator.channelId,
        subscribed: false,
        subscriberCount: 0,
      });
      expect(expectOk(await cache.isSubscribed(subscriber.id, creator.channelId))).toBeNull();
    });

    it('skips cache writes when the call changed nothing', async () => {
      await service.subscribe(subscriber, creator.channelId);
      const addSubscription = vi.spyOn(cache, 'addSubscription');

      await service.subscribe(subscriber, creator.channelId);

      expect(addSubscription).not.toHaveBeenCalled();
    });

    it.each([{ action: 'subscribe' as const }, { action: 'unsubscribe' as const }])(
      'returns CHANNEL_NOT_FOUND from $action',
      async ({ action }) => {
        expect(expectErr(await service[action](subscriber, missingChannelId)).code).toBe(
          ErrorCodes.CHANNEL_NOT_FOUND
        );
      }
    );

    it('returns CANNOT_SUBSCRIBE_TO_SELF, which the repositories no longer decide', async () => {
      const owner: UserContext = { id: creator.userId, role: 'USER' };

      expect(expectErr(await service.subscribe(owner, creator.channelId)).code).toBe(
        ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF
      );
    });
  });

  describe('isSubscribed', () => {
    it('reports an unknown channel before consulting the cache', async () => {
      expect(expectErr(await service.isSubscribed(subscriber, missingChannelId)).code).toBe(
        ErrorCodes.CHANNEL_NOT_FOUND
      );
    });

    it('primes the full subscription set on a cache miss', async () => {
      await subscriptions.subscribe(subscriber.id, creator.channelId);
      await subscriptions.subscribe(subscriber.id, otherCreator.channelId);

      const result = expectOk(await service.isSubscribed(subscriber, creator.channelId));

      expect(result).toEqual({ channelId: creator.channelId, subscribed: true });
      expect(expectOk(await cache.isSubscribed(subscriber.id, otherCreator.channelId))).toBe(true);
    });

    it('answers a primed miss without re-reading the repository', async () => {
      await service.isSubscribed(subscriber, creator.channelId);
      const getChannelIds = vi.spyOn(subscriptions, 'getUserSubscriptionChannelIds');

      const result = expectOk(await service.isSubscribed(subscriber, creator.channelId));

      expect(result).toEqual({ channelId: creator.channelId, subscribed: false });
      expect(getChannelIds).not.toHaveBeenCalled();
    });
  });

  describe('listSubscriptions', () => {
    it('serialises the subscription timestamp and mints a cursor for the next page', async () => {
      await service.subscribe(subscriber, creator.channelId);
      await service.subscribe(subscriber, otherCreator.channelId);

      const page = expectOk(await service.listSubscriptions(subscriber, { limit: 1 }));

      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.subscribedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(page.nextCursor).toEqual(expect.any(String));
    });

    it('walks its own cursor to the second page without repeating a channel', async () => {
      await service.subscribe(subscriber, creator.channelId);
      await service.subscribe(subscriber, otherCreator.channelId);

      const first = expectOk(await service.listSubscriptions(subscriber, { limit: 1 }));
      const second = expectOk(
        await service.listSubscriptions(subscriber, {
          limit: 1,
          cursor: first.nextCursor ?? undefined,
        })
      );

      expect(second.items).toHaveLength(1);
      expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
      expect(second.nextCursor).toBeNull();
    });

    it('returns no cursor when the last page fits', async () => {
      await service.subscribe(subscriber, creator.channelId);

      const page = expectOk(await service.listSubscriptions(subscriber, { limit: 10 }));

      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
    });
  });

  describe('getFeed', () => {
    beforeEach(async () => {
      for (const [index, ownerId] of [creator.userId, creator.userId].entries()) {
        await videos.create({
          id: `66666666-6666-7666-8666-66666666666${index}`,
          ownerId,
          title: `Video ${index}`,
          visibility: 'public',
          status: 'READY',
          sourceKey: `raw/v${index}.mp4`,
        });
      }
    });

    it('reports the unpaginated total alongside the page', async () => {
      await service.subscribe(subscriber, creator.channelId);

      const feed = expectOk(await service.getFeed(subscriber, { limit: 1 }));

      expect(feed.items).toHaveLength(1);
      expect(feed.total).toBe(2);
      expect(feed.nextCursor).toEqual(expect.any(String));
    });

    it('is empty for a user who subscribes to nobody', async () => {
      const feed = expectOk(await service.getFeed(subscriber, { limit: 10 }));

      expect(feed).toEqual({ items: [], nextCursor: null, total: 0 });
    });

    it('rejects a malformed cursor', async () => {
      const refused = expectErr(await service.getFeed(subscriber, { cursor: 'not-a-cursor' }));

      expect(refused.code).toBe(ErrorCodes.INVALID_CURSOR);
    });

    it('still serves the feed when the cache is down, which is why the union has no CacheUnavailable', async () => {
      const broken = new SubscriptionService({
        subscriptions,
        channels,
        cdn: TEST_CDN,
        paginator: new Paginator(),
        subscriptionCache: Object.assign(new InMemorySubscriptionCache(), {
          isSubscribed: async () => err(cacheUnavailable('isSubscribed')),
        }),
      });

      expect(expectOk(await broken.isSubscribed(subscriber, creator.channelId)).channelId).toBe(
        creator.channelId
      );
    });
  });
});
