import { expectOk } from '@kit/testing/result';
import {
  OTHER_OWNER_CHANNEL_ID as OTHER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID as CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const SUBSCRIBER_ID = '00000000-0000-7000-8000-000000000103';
const SUBSCRIBER_CHANNEL_ID = '00000000-0000-7000-8000-000000000903';

export function describeSubscriptionSourceContract(makeSubject: MakeRepositoriesSubject): void {
  describe('SubscriptionRepository source video contract', () => {
    let subject: RepositoriesSubject;

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
      await subject.repositories.channels.create({
        id: SUBSCRIBER_CHANNEL_ID,
        userId: SUBSCRIBER_ID,
        handle: 'fan',
        displayName: 'Fan',
      });
    });

    it('counts the subscriptions made from a video net, and keeps the first source of a repeat', async () => {
      const { subscriptions } = subject.repositories;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
      await subscriptions.subscribe(SUBSCRIBER_ID, SUBSCRIBER_CHANNEL_ID, CHANNEL_ID, VIDEO_IDS.a);
      await subscriptions.subscribe(SUBSCRIBER_ID, SUBSCRIBER_CHANNEL_ID, CHANNEL_ID, VIDEO_IDS.b);
      await subscriptions.subscribe(OTHER_OWNER_ID, OTHER_CHANNEL_ID, CHANNEL_ID, VIDEO_IDS.a);
      await subscriptions.subscribe(OWNER_ID, CHANNEL_ID, OTHER_CHANNEL_ID);

      expect(expectOk(await subscriptions.countFromVideo(VIDEO_IDS.a))).toBe(2);
      expect(expectOk(await subscriptions.countFromVideo(VIDEO_IDS.b))).toBe(0);

      await subscriptions.unsubscribe(SUBSCRIBER_CHANNEL_ID, CHANNEL_ID);

      expect(expectOk(await subscriptions.countFromVideo(VIDEO_IDS.a))).toBe(1);
    });
  });
}
