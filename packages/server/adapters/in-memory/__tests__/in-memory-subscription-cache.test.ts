import { expectOk } from '@vp/testing/result';
import { inMemorySubscriptionCacheSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeSubscriptionCacheContract } from '../../__tests__/contract/subscription-cache.contract';
import { InMemorySubscriptionCache } from '../in-memory-subscription-cache';

describeSubscriptionCacheContract(inMemorySubscriptionCacheSubject);

describe('InMemorySubscriptionCache', () => {
  it('clears both the sets and the counts', async () => {
    const cache = new InMemorySubscriptionCache();
    expectOk(await cache.setUserSubscriptions('user', ['channel']));
    expectOk(await cache.setSubscriberCount('channel', 5));

    cache.clear();

    expect(expectOk(await cache.isSubscribed('user', 'channel'))).toBeNull();
    expect(expectOk(await cache.getSubscriberCount('channel'))).toBeNull();
  });
});
