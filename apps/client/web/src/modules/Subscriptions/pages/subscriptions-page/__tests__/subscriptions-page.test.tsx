import { createQueryClient } from '@vp/queries';
import { api, subscribedChannel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { SubscriptionsPage } from '../subscriptions-page';

describe('apps/client/web: subscriptions page', () => {
  it('lists a card for every subscribed channel', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(mySubscriptionsQueryOptions(api).queryKey, {
      items: [
        subscribedChannel({ displayName: 'First channel' }),
        subscribedChannel({
          id: '0190c3a0-5e1d-7000-8000-00000000c002',
          displayName: 'Second channel',
        }),
      ],
      nextCursor: null,
    });

    const markup = await renderPage(<SubscriptionsPage />, AppProviders, { queryClient });

    expect(markup).toContain('First channel');
    expect(markup).toContain('Second channel');
  });

  it('titles the page, and says so when there is no subscription yet', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(mySubscriptionsQueryOptions(api).queryKey, {
      items: [],
      nextCursor: null,
    });

    const markup = await renderPage(<SubscriptionsPage />, AppProviders, { queryClient });

    expect(markup).toContain('>Your subscriptions</h1>');
    expect(markup).toContain('You are not subscribed to any channel yet');
  });
});
