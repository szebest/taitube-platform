import type { QueryClient } from '@tanstack/react-query';
import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { CHANNEL_ID, channel, subscribedChannel } from '#app/__tests__/fixtures';
import { problemResponse, runMutation } from '#app/__tests__/run-mutation';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import {
  mySubscriptionsQueryOptions,
  subscriptionStatusQueryOptions,
} from '#app/features/subscriptions/api/subscription-queries';
import { API_BASE_URL } from '#app/config';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { setSubscriptionMutationOptions } from '../use-set-subscription';

const statusKey = subscriptionStatusQueryOptions(CHANNEL_ID).queryKey;
const channelKey = channelQueryOptions(CHANNEL_ID).queryKey;
const listKey = mySubscriptionsQueryOptions().queryKey;
const feedKey = subscriptionFeedQueryOptions().queryKey;

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

function holdResponse(): () => void {
  let release = () => {};
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = () =>
          resolve(jsonResponse({ channelId: CHANNEL_ID, subscribed: true, subscriberCount: 6 }));
      })
  );
  return () => release();
}

describe('apps/web: setSubscriptionMutationOptions', () => {
  it.each([
    { action: 'a subscribe', from: false, to: true, subscribers: 6 },
    { action: 'an unsubscribe', from: true, to: false, subscribers: 4 },
  ])('shows $action before the API answers', async ({ from, to, subscribers }) => {
    const release = holdResponse();
    const client = seeded(from);

    const running = runMutation(client, setSubscriptionMutationOptions(CHANNEL_ID), to);
    await vi.waitFor(() => expect(cached(client).subscribed).toBe(to));

    expect(cached(client)).toEqual({ subscribed: to, subscribers });
    release();
    await running;
  });

  it.each([
    { action: 'subscribe', subscribed: true, method: 'POST' },
    { action: 'unsubscribe', subscribed: false, method: 'DELETE' },
  ])('sends $action as $method', async ({ subscribed, method }) => {
    const sent = recordRequests(() =>
      jsonResponse({ channelId: CHANNEL_ID, subscribed, subscriberCount: 5 })
    );

    await runMutation(seeded(!subscribed), setSubscriptionMutationOptions(CHANNEL_ID), subscribed);

    expect(sent[0]).toMatchObject({
      method,
      url: `${API_BASE_URL}/v1/channels/${CHANNEL_ID}/subscribers`,
    });
  });

  it('rolls the status and the subscriber count back when the request fails', async () => {
    recordRequests(() => problemResponse(500));
    const client = seeded(false);

    const settled = await runMutation(client, setSubscriptionMutationOptions(CHANNEL_ID), true);

    expect(settled.status).toBe('rejected');
    expect(cached(client)).toEqual({ subscribed: false, subscribers: 5 });
  });

  it('refreshes the status, the channel, the subscription list and its feed once settled', async () => {
    recordRequests(() =>
      jsonResponse({ channelId: CHANNEL_ID, subscribed: true, subscriberCount: 6 })
    );
    const client = seeded(false);

    await runMutation(client, setSubscriptionMutationOptions(CHANNEL_ID), true);

    for (const queryKey of [statusKey, channelKey, listKey, feedKey]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
