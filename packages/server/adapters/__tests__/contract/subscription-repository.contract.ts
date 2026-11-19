import type { SubscriptionRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type NewChannelAuditEntry, viewDateOf } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import {
  HOUR_MS,
  OTHER_OWNER_CHANNEL_ID as OTHER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID as CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
} from './fixtures';
import { SHARED_MILLISECOND, walkByCreatedAt } from './keyset-walk';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { AS, AS_SECOND, SUBSCRIBER_ID, seedSubscriber } from './subscriber-fixtures';

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

    const listed = async (limit: number, cursor?: { createdAt: Date; channelId: string }) =>
      expectOk(await subscriptions.listUserSubscriptions(SUBSCRIBER_ID, { limit, cursor }));

    beforeEach(async () => {
      await subject.reset();
      await seedSubscriber(subject.repositories);
      subscriptions = subject.repositories.subscriptions;
    });

    const subscribe = (channelId: string, as = AS) =>
      subscriptions.subscribe(SUBSCRIBER_ID, as, channelId);

    it('subscribes idempotently and keeps the count in step', async () => {
      const first = expectOk(await subscribe(CHANNEL_ID));
      expect(first).toEqual({ changed: true, subscriberCount: 1 });

      const repeat = expectOk(await subscribe(CHANNEL_ID));
      expect(repeat).toEqual({ changed: false, subscriberCount: 1 });

      expect(expectOk(await subscriptions.isSubscribed(AS, CHANNEL_ID))).toBe(true);
      expect(expectOk(await subscriptions.getSubscriberCount(CHANNEL_ID))).toBe(1);
    });

    it('writes the audit row it is handed with the subscription it creates, and with no other', async () => {
      const subscribed: NewChannelAuditEntry = {
        channelId: AS,
        actorUserId: SUBSCRIBER_ID,
        action: 'channel.subscribed',
        targetType: 'channel',
        targetId: CHANNEL_ID,
        meta: {},
      };

      for (let call = 0; call < 2; call++) {
        expectOk(await subscriptions.subscribe(SUBSCRIBER_ID, AS, CHANNEL_ID, null, subscribed));
      }

      const audit = expectOk(
        await subject.repositories.channelAudit.list(AS, { cursor: null, limit: 5 })
      );
      expect(audit).toEqual([expect.objectContaining(subscribed)]);
    });

    it('unsubscribes idempotently', async () => {
      await subscribe(CHANNEL_ID);

      expect(expectOk(await subscriptions.unsubscribe(AS, CHANNEL_ID))).toEqual({
        changed: true,
        subscriberCount: 0,
      });
      expect(expectOk(await subscriptions.unsubscribe(AS, CHANNEL_ID))).toEqual({
        changed: false,
        subscriberCount: 0,
      });
      expect(expectOk(await subscriptions.isSubscribed(AS, CHANNEL_ID))).toBe(false);
    });

    it.each([
      {
        name: 'subscribing to',
        write: (s: SubscriptionRepositoryPort) => s.subscribe(SUBSCRIBER_ID, AS, ABSENT_CHANNEL_ID),
      },
      {
        name: 'unsubscribing from',
        write: (s: SubscriptionRepositoryPort) => s.unsubscribe(AS, ABSENT_CHANNEL_ID),
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
      await subscribe(CHANNEL_ID);
      await subscribe(OTHER_CHANNEL_ID);

      const ids = expectOk(await subscriptions.getUserSubscriptionChannelIds(SUBSCRIBER_ID));
      expect([...ids].sort()).toEqual([CHANNEL_ID, OTHER_CHANNEL_ID].sort());
      expect(expectOk(await subscriptions.getUserSubscriptionChannelIds(OWNER_ID))).toEqual([]);
    });

    it('lists the subscribed channels newest first, over-fetching one row', async () => {
      await subscribe(CHANNEL_ID);
      await subscribe(OTHER_CHANNEL_ID);

      const page = await listed(1);
      expect(page).toHaveLength(2);
      expect(page[0]?.id).toBe(OTHER_CHANNEL_ID);
      expect(page[0]?.handle).toBe('other');
      expect(page[0]?.subscribedAt).toBeInstanceOf(Date);
    });

    it('carries the channel profile and its count on each listed subscription', async () => {
      await subscribe(CHANNEL_ID);

      const [row] = await listed(10);

      expect(row).toMatchObject({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
        subscriberCount: 1,
      });
    });

    it('resumes the subscriptions from a cursor within one millisecond without repeating a channel', async () => {
      await subscribe(CHANNEL_ID);
      await subscribe(OTHER_CHANNEL_ID);
      await subject.spreadAcrossMicroseconds({
        stamp: schema.channelSubscriptions.createdAt,
        key: schema.channelSubscriptions.channelId,
        ids: [CHANNEL_ID, OTHER_CHANNEL_ID],
        at: SHARED_MILLISECOND,
      });
      const [first] = await listed(1);
      if (!first) throw new Error('the first page is empty');

      const next = await listed(1, { createdAt: first.subscribedAt, channelId: first.id });

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

      await subscribe(CHANNEL_ID);
      const feed = expectOk(await subscriptions.getSubscriptionFeed(SUBSCRIBER_ID, { limit: 10 }));

      expect(idsOf(feed.items)).toEqual([VIDEO_IDS.a]);
      expect(feed.total).toBe(1);
    });

    it('walks the feed on from a cursor through videos that share a millisecond', async () => {
      const ids = [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c];
      for (const id of ids) await subject.seedVideo(publicVideo({ id }), SHARED_MILLISECOND);
      await subscribe(CHANNEL_ID);
      await subject.spreadAcrossMicroseconds({
        stamp: schema.videos.createdAt,
        key: schema.videos.id,
        ids,
        at: SHARED_MILLISECOND,
      });

      const served = await walkByCreatedAt(
        async (cursor) =>
          expectOk(
            await subscriptions.getSubscriptionFeed(SUBSCRIBER_ID, {
              limit: 1,
              cursor: cursor ?? undefined,
            })
          ).items
      );

      expect(served.sort()).toEqual(ids.sort());
    });

    it('returns an empty feed for a user with no subscriptions', async () => {
      const feed = expectOk(await subscriptions.getSubscriptionFeed(OWNER_ID, { limit: 10 }));
      expect(feed.items).toEqual([]);
      expect(feed.total).toBe(0);
    });

    it('stores a notification level per subscription, all by default', async () => {
      await subscribe(CHANNEL_ID);
      const levels = async () => (await listed(10)).map((item) => item.notificationLevel);
      expect(await levels()).toEqual(['all']);

      expect(expectOk(await subscriptions.setNotificationLevel(AS, CHANNEL_ID, 'none'))).toBe(true);
      expect(await levels()).toEqual(['none']);
    });

    it('sets no level for a subscription that is not there', async () => {
      expect(expectOk(await subscriptions.setNotificationLevel(AS, CHANNEL_ID, 'none'))).toBe(
        false
      );
    });

    it('nets the gains and losses of a channel over the days of a range', async () => {
      await subscribe(CHANNEL_ID);
      await subscribe(CHANNEL_ID, AS_SECOND);
      await subscriptions.unsubscribe(AS, CHANNEL_ID);
      await subscribe(OTHER_CHANNEL_ID);
      const today = viewDateOf(new Date());
      const yesterday = viewDateOf(new Date(Date.now() - MS_PER_DAY));

      expect(
        expectOk(await subscriptions.netSubscribers(CHANNEL_ID, { from: today, to: today }))
      ).toBe(1);
      expect(
        expectOk(await subscriptions.netSubscribers(CHANNEL_ID, { from: yesterday, to: yesterday }))
      ).toBe(0);
      expect(
        expectOk(await subscriptions.netSubscribers(OTHER_CHANNEL_ID, { from: today, to: today }))
      ).toBe(1);
    });
  });
}
