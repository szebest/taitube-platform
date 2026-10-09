import { subscribedChannel } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { mySubscriptionsQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { SubscriptionsPage } from '../subscriptions-page';

describe('apps/client/web: subscriptions page', () => {
  it('lists a card for every subscribed channel', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(mySubscriptionsQueryOptions().queryKey, {
      items: [
        subscribedChannel({ displayName: 'First channel' }),
        subscribedChannel({
          id: '0190c3a0-5e1d-7000-8000-00000000c002',
          displayName: 'Second channel',
        }),
      ],
      nextCursor: null,
    });

    const markup = await renderPage(<SubscriptionsPage />, { queryClient });

    expect(markup).toContain('First channel');
    expect(markup).toContain('Second channel');
  });
});
