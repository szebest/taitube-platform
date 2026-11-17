import { expectOk } from '@vp/testing/result';
import { creator, otherCreator, subscriber, subscriptionHarness } from './subscription-harness';

const ABSENT_VIDEO_ID = '00000000-0000-7000-8000-0000000000ff';

describe('SubscriptionService: subscribing from a video', () => {
  let videos: Awaited<ReturnType<typeof subscriptionHarness>>['videos'];
  let subscriptions: Awaited<ReturnType<typeof subscriptionHarness>>['subscriptions'];
  let service: Awaited<ReturnType<typeof subscriptionHarness>>['service'];

  beforeEach(async () => {
    ({ videos, subscriptions, service } = await subscriptionHarness());
  });

  const watched = [
    {
      video: 'a public video of the channel',
      id: '66666666-6666-7666-8666-666666666601',
      ownerId: creator.userId,
      visibility: 'public' as const,
      credited: 1,
    },
    {
      video: 'a private video of the channel',
      id: '66666666-6666-7666-8666-666666666602',
      ownerId: creator.userId,
      visibility: 'private' as const,
      credited: 0,
    },
    {
      video: 'a public video of another channel',
      id: '66666666-6666-7666-8666-666666666603',
      ownerId: otherCreator.userId,
      visibility: 'public' as const,
      credited: 0,
    },
  ];

  beforeEach(async () => {
    for (const { id, ownerId, visibility } of watched) {
      await videos.create({
        id,
        ownerId,
        visibility,
        status: 'READY',
        sourceKey: `raw/${id}.mp4`,
      });
    }
  });

  it.each(watched)('credits $video: $credited', async ({ id, credited }) => {
    const result = expectOk(await service.subscribe(subscriber, creator.channelId, id));

    expect(result.subscribed).toBe(true);
    expect(expectOk(await subscriptions.countFromVideo(id))).toBe(credited);
  });

  it('credits nothing for a video id that does not exist, and still subscribes', async () => {
    const result = expectOk(
      await service.subscribe(subscriber, creator.channelId, ABSENT_VIDEO_ID)
    );

    expect(result.subscriberCount).toBe(1);
    expect(expectOk(await subscriptions.countFromVideo(ABSENT_VIDEO_ID))).toBe(0);
  });
});
