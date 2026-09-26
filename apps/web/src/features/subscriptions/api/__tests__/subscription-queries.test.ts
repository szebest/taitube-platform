import type { QueryKey } from '@tanstack/react-query';
import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { CHANNEL_ID, subscribedChannel } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import {
  mySubscriptionsQueryOptions,
  subscriptionKeys,
  subscriptionStatusQueryOptions,
} from '../subscription-queries';

describe('apps/web: subscription queries', () => {
  it.each<{ query: string; fetch: () => Promise<unknown>; body: unknown; url: string }>([
    {
      query: "the caller's subscriptions",
      fetch: () => createQueryClient().fetchQuery(mySubscriptionsQueryOptions()),
      body: { items: [subscribedChannel()], nextCursor: null },
      url: `${API_BASE_URL}/v1/me/subscriptions`,
    },
    {
      query: 'whether the caller follows a channel',
      fetch: () => createQueryClient().fetchQuery(subscriptionStatusQueryOptions(CHANNEL_ID)),
      body: { channelId: CHANNEL_ID, subscribed: true },
      url: `${API_BASE_URL}/v1/channels/${CHANNEL_ID}/subscribers/me`,
    },
  ])('reads $query with GET $url', async ({ fetch, body, url }) => {
    const sent = recordRequests(() => jsonResponse(body));

    await fetch();

    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([`GET ${url}`]);
  });

  it.each<{ query: string; queryKey: QueryKey }>([
    { query: 'the list', queryKey: mySubscriptionsQueryOptions().queryKey },
    { query: 'the status', queryKey: subscriptionStatusQueryOptions(CHANNEL_ID).queryKey },
  ])('files $query under the subscriptions key', ({ queryKey }) => {
    expect(queryKey.slice(0, subscriptionKeys.all.length)).toEqual([...subscriptionKeys.all]);
  });
});
