import { createQueryClient } from '@vp/queries';
import { api, CHANNEL_ID, subscribedChannel } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { mySubscriptionsQueryOptions } from '#app/lib/query-keys/subscription-keys';
import { SubscriptionsPage } from '../subscriptions-page';

function renderSubscriptions(items: ReturnType<typeof subscribedChannel>[]) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(mySubscriptionsQueryOptions(api).queryKey, { items, nextCursor: null });

  return renderPage(<SubscriptionsPage />, AppProviders, { queryClient });
}

describe('apps/client/web: subscriptions page', () => {
  it('lists a row for every subscribed channel, each linking to its channel', async () => {
    const markup = await renderSubscriptions([
      subscribedChannel({ displayName: 'First channel' }),
      subscribedChannel({
        id: '0190c3a0-5e1d-7000-8000-00000000c002',
        displayName: 'Second channel',
      }),
    ]);

    expect(markup).toContain('>First channel</h2>');
    expect(markup).toContain('>Second channel</h2>');
    expect(markup).toContain(`href="/channel/${CHANNEL_ID}"`);
  });

  it('titles the page, and says so when there is no subscription yet', async () => {
    const markup = await renderSubscriptions([]);

    expect(markup).toContain('>Your subscriptions</h1>');
    expect(markup).toContain('You are not subscribed to any channel yet');
  });
});
