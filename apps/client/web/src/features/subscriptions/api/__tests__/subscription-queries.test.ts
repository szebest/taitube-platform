import type { QueryKey } from '@tanstack/react-query';
import { isSubscribedToChannel, listMySubscriptions } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { CHANNEL_ID, apiServer, subscribedChannel } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { api, mockEndpoint } from '@vp/web-testing';
import {
  mySubscriptionsQueryOptions,
  subscriptionKeys,
  subscriptionStatusQueryOptions,
} from '../subscription-queries';

describe('apps/client/web: subscription queries', () => {
  it("reads the caller's subscriptions", async () => {
    const list = { items: [subscribedChannel()], nextCursor: null };
    apiServer.use(mockEndpoint(listMySubscriptions, () => HttpResponse.json(list)));

    const loaded = await createQueryClient().fetchQuery(mySubscriptionsQueryOptions(api));

    expect(loaded.items.map(({ id }) => id)).toEqual([CHANNEL_ID]);
  });

  it('reads whether the caller follows a channel', async () => {
    apiServer.use(
      mockEndpoint(isSubscribedToChannel, ({ params }) =>
        HttpResponse.json({ channelId: String(params.id), subscribed: true })
      )
    );

    const loaded = await createQueryClient().fetchQuery(
      subscriptionStatusQueryOptions(api, CHANNEL_ID)
    );

    expect(loaded).toEqual({ channelId: CHANNEL_ID, subscribed: true });
  });

  it.each<{ query: string; queryKey: QueryKey }>([
    { query: 'the list', queryKey: mySubscriptionsQueryOptions(api).queryKey },
    { query: 'the status', queryKey: subscriptionStatusQueryOptions(api, CHANNEL_ID).queryKey },
  ])('files $query under the subscriptions key', ({ queryKey }) => {
    expect(queryKey.slice(0, subscriptionKeys.all.length)).toEqual([...subscriptionKeys.all]);
  });
});
