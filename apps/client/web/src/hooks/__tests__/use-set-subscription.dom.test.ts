import type { QueryClient } from '@tanstack/react-query';
import { type ContractResult, subscribeToChannel, unsubscribeFromChannel } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import {
  api,
  apiServer,
  CHANNEL_ID,
  channel,
  mockEndpoint,
  problemReply,
  subscribedChannel,
} from '@vp/web-testing';
import { heldReply, runMutation } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import {
  channelQueryOptions,
  channelSpotlightQueryOptions,
} from '#app/lib/query-keys/channel-keys';
import { subscriptionFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
import {
  mySubscriptionsQueryOptions,
  subscriptionStatusQueryOptions,
} from '#app/lib/query-keys/subscription-keys';
import { useSetSubscription } from '../use-set-subscription';

type SubscriptionState = ContractResult<typeof subscribeToChannel>;
const statusKey = subscriptionStatusQueryOptions(api, CHANNEL_ID).queryKey;
const channelKey = channelQueryOptions(api, CHANNEL_ID).queryKey;
const spotlightKey = channelSpotlightQueryOptions(api, CHANNEL_ID, 'en', null).queryKey;
const listKey = mySubscriptionsQueryOptions(api).queryKey;
const feedKey = subscriptionFeedQueryOptions(api).queryKey;

function state(subscribed: boolean) {
  return () =>
    HttpResponse.json<SubscriptionState>({ channelId: CHANNEL_ID, subscribed, subscriberCount: 5 });
}

function seeded(subscribed: boolean): QueryClient {
  const client = createQueryClient();
  client.setQueryData(statusKey, { channelId: CHANNEL_ID, subscribed });
  client.setQueryData(channelKey, channel({ subscriberCount: 5 }));
  client.setQueryData(spotlightKey, { source: 'trailer', video: null });
  client.setQueryData(listKey, { items: [subscribedChannel()], nextCursor: null });
  client.setQueryData(feedKey, { pages: [], pageParams: [] });
  return client;
}

function cached(client: QueryClient) {
  return {
    subscribed: client.getQueryData(statusKey)?.subscribed,
    subscribers: client.getQueryData(channelKey)?.subscriberCount,
  };
}

describe('apps/client/web: useSetSubscription', () => {
  type Answer = () => Promise<HttpResponse<SubscriptionState>>;

  it.each<{
    action: string;
    handler: (answer: Answer) => HttpHandler;
    from: boolean;
    to: boolean;
    subscribers: number;
  }>([
    {
      action: 'a subscribe',
      handler: (answer) => mockEndpoint(subscribeToChannel, answer),
      from: false,
      to: true,
      subscribers: 6,
    },
    {
      action: 'an unsubscribe',
      handler: (answer) => mockEndpoint(unsubscribeFromChannel, answer),
      from: true,
      to: false,
      subscribers: 4,
    },
  ])('shows $action before the API answers', async ({ handler, from, to, subscribers }) => {
    const held = heldReply(state(to));
    apiServer.use(handler(held.answer));
    const client = seeded(from);

    const running = runMutation(client, () => useSetSubscription(CHANNEL_ID), to, AppProviders);
    await vi.waitFor(() => expect(cached(client).subscribed).toBe(to));

    expect(cached(client)).toEqual({ subscribed: to, subscribers });
    held.release();
    await expect(running).resolves.toMatchObject({ status: 'fulfilled' });
  });

  it('rolls the status and the subscriber count back when the request fails', async () => {
    apiServer.use(mockEndpoint(subscribeToChannel, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded(false);

    const settled = await runMutation(
      client,
      () => useSetSubscription(CHANNEL_ID),
      true,
      AppProviders
    );

    expect(settled.status).toBe('rejected');
    expect(cached(client)).toEqual({ subscribed: false, subscribers: 5 });
  });

  it('marks the status, the channel, its spotlight, the subscription list and its feed stale once settled', async () => {
    apiServer.use(mockEndpoint(subscribeToChannel, state(true)));
    const client = seeded(false);

    await runMutation(client, () => useSetSubscription(CHANNEL_ID), true, AppProviders);

    for (const queryKey of [statusKey, channelKey, spotlightKey, listKey, feedKey]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
