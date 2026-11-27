import { Paginator } from '@kit/pagination';
import {
  InMemoryChannelAuditRepository,
  InMemoryChannelHandleHistoryRepository,
  InMemoryChannelRepository,
  InMemoryEventRepository,
  InMemoryOutboxRepository,
  InMemoryRenditionRepository,
  InMemoryStepRepository,
  InMemorySubscriptionCache,
  InMemorySubscriptionRepository,
  InMemoryVideoRepository,
  InMemoryWatchHistoryRepository,
} from '@vp/adapters/in-memory';
import type { ActingChannel } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { SubscriptionService } from '../subscription-service';
import { ViewerProgress } from '../viewer-progress';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

export const creator = {
  userId: '11111111-1111-7111-8111-111111111111',
  channelId: '22222222-2222-7222-8222-222222222222',
};
export const otherCreator = {
  userId: '33333333-3333-7333-8333-333333333333',
  channelId: '44444444-4444-7444-8444-444444444444',
};
export const subscriber: UserContext = {
  id: '55555555-5555-7555-8555-555555555555',
  email: 'subscriber@example.com',
  role: 'USER',
};
/** The subscriber acting as their own channel, the default when no channel is named. */
export const asSubscriber: ActingChannel = {
  channelId: '66666666-6666-7666-8666-666666666666',
  ownerId: subscriber.id,
  role: 'owner',
};
/** A second channel the subscriber owns. */
export const asSubscriberSecond: ActingChannel = {
  channelId: '77777777-7777-7777-8777-777777777777',
  ownerId: subscriber.id,
  role: 'owner',
};

/** A service over in-memory repositories and the two creators' channels. */
export async function subscriptionHarness() {
  const videos = new InMemoryVideoRepository({
    eventsRepo: new InMemoryEventRepository(),
    outboxRepo: new InMemoryOutboxRepository(),
    renditionsRepo: new InMemoryRenditionRepository(),
    stepsRepo: new InMemoryStepRepository(),
  });
  const audit = new InMemoryChannelAuditRepository();
  const channels = new InMemoryChannelRepository(
    videos,
    new InMemoryChannelHandleHistoryRepository(),
    audit
  );
  const subscriptions = new InMemorySubscriptionRepository({
    channelsRepo: channels,
    videosRepo: videos,
    auditRepo: audit,
  });
  const cache = new InMemorySubscriptionCache();
  const viewerProgress = new ViewerProgress(
    new InMemoryWatchHistoryRepository({ channelsRepo: channels, videosRepo: videos })
  );
  const serviceOver = (subscriptionCache: InMemorySubscriptionCache) =>
    new SubscriptionService({
      subscriptions,
      channels,
      videos,
      subscriptionCache,
      viewerProgress,
      home: { forget: async () => {} },
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
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
  for (const [acting, handle] of [
    [asSubscriber, 'subscriber'],
    [asSubscriberSecond, 'subscriber_two'],
  ] as const) {
    await channels.create({
      id: acting.channelId,
      userId: subscriber.id,
      handle,
      displayName: handle,
    });
  }

  return { videos, subscriptions, cache, audit, service: serviceOver(cache), serviceOver };
}
