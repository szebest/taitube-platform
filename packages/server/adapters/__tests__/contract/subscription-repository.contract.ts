import type { SubscriptionRepositoryPort } from '@vp/core/repositories';
import {
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
  seedOwners,
} from './fixtures';
import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const SUBSCRIBER_ID = '00000000-0000-7000-8000-000000000103';
const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-000000000902';

export function describeSubscriptionRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SubscriptionRepository contract', () => {
    let subject: RepositoriesSubject;
    let subscriptions: SubscriptionRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.repositories.users.upsert({
        id: SUBSCRIBER_ID,
        email: 'subscriber@video-pipeline.local',
      });
      subscriptions = subject.repositories.subscriptions;

      await subject.repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'owner-channel',
        displayName: 'Owner Channel',
      });
      await subject.repositories.channels.create({
        id: OTHER_CHANNEL_ID,
        userId: OTHER_OWNER_ID,
        handle: 'other-channel',
        displayName: 'Other Channel',
      });
    });

    it('subscribes idempotently and keeps the count in step', async () => {
      const first = expectOk(await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID));
      expect(first).toEqual({ changed: true, subscriberCount: 1 });

      const repeat = expectOk(await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID));
      expect(repeat).toEqual({ changed: false, subscriberCount: 1 });

      expect(expectOk(await subscriptions.isSubscribed(SUBSCRIBER_ID, CHANNEL_ID))).toBe(true);
      expect(expectOk(await subscriptions.getSubscriberCount(CHANNEL_ID))).toBe(1);
    });

    it('unsubscribes idempotently', async () => {
      await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID);

      expect(expectOk(await subscriptions.unsubscribe(SUBSCRIBER_ID, CHANNEL_ID))).toEqual({
        changed: true,
        subscriberCount: 0,
      });
      expect(expectOk(await subscriptions.unsubscribe(SUBSCRIBER_ID, CHANNEL_ID))).toEqual({
        changed: false,
        subscriberCount: 0,
      });
      expect(expectOk(await subscriptions.isSubscribed(SUBSCRIBER_ID, CHANNEL_ID))).toBe(false);
    });

    it('lists the channel ids a user follows', async () => {
      await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID);
      await subscriptions.subscribe(SUBSCRIBER_ID, OTHER_CHANNEL_ID);

      const ids = expectOk(await subscriptions.getUserSubscriptionChannelIds(SUBSCRIBER_ID));
      expect([...ids].sort()).toEqual([CHANNEL_ID, OTHER_CHANNEL_ID].sort());
      expect(expectOk(await subscriptions.getUserSubscriptionChannelIds(OWNER_ID))).toEqual([]);
    });

    it('lists the subscribed channels newest first, over-fetching one row', async () => {
      await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID);
      await subscriptions.subscribe(SUBSCRIBER_ID, OTHER_CHANNEL_ID);

      const page = expectOk(await subscriptions.listUserSubscriptions(SUBSCRIBER_ID, { limit: 1 }));
      expect(page).toHaveLength(2);
      expect(page[0]?.id).toBe(OTHER_CHANNEL_ID);
      expect(page[0]?.handle).toBe('other-channel');
      expect(page[0]?.subscribedAt).toBeInstanceOf(Date);
    });

    it('feeds the public videos of the subscribed channels only', async () => {
      const now = Date.now();
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }), new Date(now - 1 * HOUR_MS));
      await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.b, ownerId: OTHER_OWNER_ID }),
        new Date(now - 2 * HOUR_MS)
      );
      await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.c, visibility: 'private' }),
        new Date(now - 3 * HOUR_MS)
      );

      await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID);
      const feed = expectOk(await subscriptions.getSubscriptionFeed(SUBSCRIBER_ID, { limit: 10 }));

      expect(idsOf(feed.items)).toEqual([VIDEO_IDS.a]);
      expect(feed.total).toBe(1);
    });

    it('returns an empty feed for a user with no subscriptions', async () => {
      const feed = expectOk(await subscriptions.getSubscriptionFeed(OWNER_ID, { limit: 10 }));
      expect(feed.items).toEqual([]);
      expect(feed.total).toBe(0);
    });
  });
}
