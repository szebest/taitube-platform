import { createApiStore, seed } from '../../../../../__tests__/api-store';
import { subscribedChannel } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { subscriptionsApi } from '../../../../shared/api/subscriptions-api';
import { SubscriptionsPage } from '../subscriptions-page';

describe('apps/web: subscriptions page', () => {
  it('shows the spinner while the subscriptions load', async () => {
    expect(await renderPage(<SubscriptionsPage />)).toContain('aria-label="Loading"');
  });

  it('lists a card for every subscribed channel', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(subscriptionsApi.endpoints.mySubscriptions.initiate()),
      {
        items: [
          subscribedChannel({ displayName: 'First channel' }),
          subscribedChannel({
            id: '0190c3a0-5e1d-7000-8000-00000000c002',
            displayName: 'Second channel',
          }),
        ],
        nextCursor: null,
      }
    );

    const markup = await renderPage(<SubscriptionsPage />, { store });

    expect(markup).toContain('First channel');
    expect(markup).toContain('Second channel');
  });
});
