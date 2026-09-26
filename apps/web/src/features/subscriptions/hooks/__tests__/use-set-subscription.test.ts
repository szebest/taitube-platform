import type { QueryClient } from '@tanstack/react-query';
import {
  type SubscriptionState,
  subscribeToChannel,
  unsubscribeFromChannel,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { type HttpHandler, HttpResponse } from 'msw';
import { CHANNEL_ID, channel, subscribedChannel } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { heldReply, runMutation } from '#app/__tests__/run-mutation';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import {
  mySubscriptionsQueryOptions,
  subscriptionStatusQueryOptions,
} from '#app/features/subscriptions/api/subscription-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { setSubscriptionMutationOptions } from '../use-set-subscription';

const statusKey = subscriptionStatusQueryOptions(CHANNEL_ID).queryKey;
const channelKey = channelQueryOptions(CHANNEL_ID).queryKey;
const listKey = mySubscriptionsQueryOptions().queryKey;
const feedKey = subscriptionFeedQueryOptions().queryKey;

function state(subscribed: boolean) {
  return () =>
    HttpResponse.json<SubscriptionState>({ channelId: CHANNEL_ID, subscribed, subscriberCount: 5 });
}

function seeded(subscribed: boolean): QueryClient {
  const client = createQueryClient();
  client.setQueryData(statusKey, { channelId: CHANNEL_ID, subscribed });
  client.setQueryData(channelKey, channel({ subscriberCount: 5 }));
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

describe('apps/web: setSubscriptionMutationOptions', () => {
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

    const running = runMutation(client, setSubscriptionMutationOptions(CHANNEL_ID), to);
    await vi.waitFor(() => expect(cached(client).subscribed).toBe(to));

    expect(cached(client)).toEqual({ subscribed: to, subscribers });
    held.release();
    await expect(running).resolves.toMatchObject({ status: 'fulfilled' });
  });

  it('rolls the status and the subscriber count back when the request fails', async () => {
    apiServer.use(mockEndpoint(subscribeToChannel, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded(false);

    const settled = await runMutation(client, setSubscriptionMutationOptions(CHANNEL_ID), true);

    expect(settled.status).toBe('rejected');
    expect(cached(client)).toEqual({ subscribed: false, subscribers: 5 });
  });

  it('marks the status, the channel, the subscription list and its feed stale once settled', async () => {
    apiServer.use(mockEndpoint(subscribeToChannel, state(true)));
    const client = seeded(false);

    await runMutation(client, setSubscriptionMutationOptions(CHANNEL_ID), true);

    for (const queryKey of [statusKey, channelKey, listKey, feedKey]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
