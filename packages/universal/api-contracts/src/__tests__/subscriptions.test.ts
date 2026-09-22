import {
  SubscriptionStateSchema,
  getSubscriptionFeed,
  isSubscribedToChannel,
  listMySubscriptions,
  subscribeToChannel,
  unsubscribeFromChannel,
} from '../subscriptions';

describe('packages/api-contracts: subscriptions', () => {
  it.each([
    [subscribeToChannel, 'POST', '/v1/channels/:id/subscribers'],
    [unsubscribeFromChannel, 'DELETE', '/v1/channels/:id/subscribers'],
    [isSubscribedToChannel, 'GET', '/v1/channels/:id/subscribers/me'],
    [listMySubscriptions, 'GET', '/v1/me/subscriptions'],
    [getSubscriptionFeed, 'GET', '/v1/feed/subscriptions'],
  ])('declares %#: $method $path', (contract, method, path) => {
    expect(contract.method).toBe(method);
    expect(contract.path).toBe(path);
  });

  it('answers subscribe and unsubscribe with the same state shape', () => {
    const state = {
      channelId: '00000000-0000-7000-8000-0000000000a1',
      subscribed: true,
      subscriberCount: 1,
    };

    expect(subscribeToChannel.result.parse(state)).toEqual(state);
    expect(unsubscribeFromChannel.result.parse({ ...state, subscribed: false })).toMatchObject({
      subscribed: false,
    });
    expect(SubscriptionStateSchema.safeParse({ ...state, subscriberCount: -1 }).success).toBe(
      false
    );
  });

  it('refuses self-subscription with a dedicated 400 code', () => {
    expect(subscribeToChannel.errors[400]).toContain('CANNOT_SUBSCRIBE_TO_SELF');
  });
});
