import type { QueryKey } from '@tanstack/react-query';
import { isSubscribedToChannel, listMySubscriptions } from '@vp/api-contracts';
import { HttpResponse } from 'msw';
import { CHANNEL_ID, subscribedChannel } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import {
  mySubscriptionsQueryOptions,
  subscriptionKeys,
  subscriptionStatusQueryOptions,
} from '../subscription-queries';

describe('apps/web: subscription queries', () => {
  it("reads the caller's subscriptions", async () => {
    const list = { items: [subscribedChannel()], nextCursor: null };
    apiServer.use(mockEndpoint(listMySubscriptions, () => HttpResponse.json(list)));

    const loaded = await createQueryClient().fetchQuery(mySubscriptionsQueryOptions());

    expect(loaded.items.map(({ id }) => id)).toEqual([CHANNEL_ID]);
  });

  it('reads whether the caller follows a channel', async () => {
    apiServer.use(
      mockEndpoint(isSubscribedToChannel, ({ params }) =>
        HttpResponse.json({ channelId: String(params.id), subscribed: true })
      )
    );

    const loaded = await createQueryClient().fetchQuery(subscriptionStatusQueryOptions(CHANNEL_ID));

    expect(loaded).toEqual({ channelId: CHANNEL_ID, subscribed: true });
  });

  it.each<{ query: string; queryKey: QueryKey }>([
    { query: 'the list', queryKey: mySubscriptionsQueryOptions().queryKey },
    { query: 'the status', queryKey: subscriptionStatusQueryOptions(CHANNEL_ID).queryKey },
  ])('files $query under the subscriptions key', ({ queryKey }) => {
    expect(queryKey.slice(0, subscriptionKeys.all.length)).toEqual([...subscriptionKeys.all]);
  });
});
