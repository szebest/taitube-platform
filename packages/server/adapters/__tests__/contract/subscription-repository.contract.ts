import type { SubscriptionRepositoryPort } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import {
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const SUBSCRIBER_ID = '00000000-0000-7000-8000-000000000103';
const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-000000000902';
const ABSENT_CHANNEL_ID = '00000000-0000-7000-8000-0000000009ff';

export function describeSubscriptionRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SubscriptionRepository contract', () => {
    let subject: RepositoriesSubject;
    let subscriptions: SubscriptionRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
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

    it.each([
      {
        name: 'subscribing to',
        write: (s: SubscriptionRepositoryPort) => s.subscribe(SUBSCRIBER_ID, ABSENT_CHANNEL_ID),
      },
      {
        name: 'unsubscribing from',
        write: (s: SubscriptionRepositoryPort) => s.unsubscribe(SUBSCRIBER_ID, ABSENT_CHANNEL_ID),
      },
    ])(
      'reports $name a channel that is not there as a write that changed nothing',
      async ({ write }) => {
        expect(expectOk(await write(subscriptions))).toEqual({
          changed: false,
          subscriberCount: 0,
        });
      }
    );

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

    it('carries the channel profile and its count on each listed subscription', async () => {
      await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID);

      const [row] = expectOk(
        await subscriptions.listUserSubscriptions(SUBSCRIBER_ID, { limit: 10 })
      );

      expect(row).toMatchObject({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'owner-channel',
        displayName: 'Owner Channel',
        subscriberCount: 1,
      });
    });

    it('resumes the subscription listing from a keyset cursor without repeating a channel', async () => {
      await subscriptions.subscribe(SUBSCRIBER_ID, CHANNEL_ID);
      await subscriptions.subscribe(SUBSCRIBER_ID, OTHER_CHANNEL_ID);
      const [first] = expectOk(
        await subscriptions.listUserSubscriptions(SUBSCRIBER_ID, { limit: 1 })
      );
      if (!first) throw new Error('the first page is empty');

      const next = expectOk(
        await subscriptions.listUserSubscriptions(SUBSCRIBER_ID, {
          limit: 1,
          cursor: { createdAt: first.subscribedAt, channelId: first.id },
        })
      );

      expect(next.map((row) => row.id)).toEqual([CHANNEL_ID]);
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
