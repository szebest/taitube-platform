import type { SubscriptionRepositoryPort } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import {
  OTHER_OWNER_CHANNEL_ID as OTHER_CHANNEL_ID,
  OWNER_CHANNEL_ID as CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  publicVideo,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { AS, AS_SECOND, SUBSCRIBER_ID, seedSubscriber } from './subscriber-fixtures';

/** An account subscribes from each of its channels; its account-wide reads name a channel once. */
export function describeSubscriptionChannelsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SubscriptionRepository subscribing channels contract', () => {
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
      await seedSubscriber(subject.repositories);
      subscriptions = subject.repositories.subscriptions;
    });

    const subscribe = (channelId: string, as = AS) =>
      subscriptions.subscribe(SUBSCRIBER_ID, as, channelId);

    const listed = async () =>
      expectOk(await subscriptions.listUserSubscriptions(SUBSCRIBER_ID, { limit: 10 }));

    it('keeps a subscription per subscribing channel', async () => {
      await subscribe(CHANNEL_ID);

      expect(expectOk(await subscriptions.isSubscribed(AS_SECOND, CHANNEL_ID))).toBe(false);
      expect(expectOk(await subscribe(CHANNEL_ID, AS_SECOND))).toEqual({
        changed: true,
        subscriberCount: 2,
      });
      expect(expectOk(await subscriptions.unsubscribe(AS_SECOND, CHANNEL_ID))).toEqual({
        changed: true,
        subscriberCount: 1,
      });
      expect(expectOk(await subscriptions.isSubscribed(AS, CHANNEL_ID))).toBe(true);
    });

    it('names a channel once in the account-wide reads, however many of its channels follow it', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subscribe(CHANNEL_ID);
      await subscribe(CHANNEL_ID, AS_SECOND);

      const ids = expectOk(await subscriptions.getUserSubscriptionChannelIds(SUBSCRIBER_ID));
      const feed = expectOk(await subscriptions.getSubscriptionFeed(SUBSCRIBER_ID, { limit: 10 }));

      expect(ids).toEqual([CHANNEL_ID]);
      expect(idsOf(await listed())).toEqual([CHANNEL_ID]);
      expect(idsOf(feed.items)).toEqual([VIDEO_IDS.a]);
      expect(feed.total).toBe(1);
    });

    it('walks the subscribing accounts in batches, each once at its loudest level', async () => {
      await subscriptions.subscribe(OWNER_ID, CHANNEL_ID, OTHER_CHANNEL_ID);
      await subscribe(OTHER_CHANNEL_ID);
      await subscribe(OTHER_CHANNEL_ID, AS_SECOND);
      await subscriptions.setNotificationLevel(AS, OTHER_CHANNEL_ID, 'none');
      await subscriptions.setNotificationLevel(AS_SECOND, OTHER_CHANNEL_ID, 'highlights');
      await subscribe(CHANNEL_ID);
      const [firstId, secondId] = [OWNER_ID, SUBSCRIBER_ID].sort();

      const first = expectOk(await subscriptions.listSubscribers(OTHER_CHANNEL_ID, { limit: 1 }));
      const rest = expectOk(
        await subscriptions.listSubscribers(OTHER_CHANNEL_ID, { limit: 1, after: firstId })
      );
      const levelOf: Record<string, string> = { [OWNER_ID]: 'all', [SUBSCRIBER_ID]: 'highlights' };

      expect([...first, ...rest]).toEqual([
        { subscriberId: firstId, notificationLevel: levelOf[firstId ?? ''] },
        { subscriberId: secondId, notificationLevel: levelOf[secondId ?? ''] },
      ]);
    });
  });
}
