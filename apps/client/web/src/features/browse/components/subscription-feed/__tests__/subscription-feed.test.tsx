import { createQueryClient } from '@vp/queries';
import { api, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProvidersWithToasts } from '#app/__tests__/providers';
import { subscriptionFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
import { SubscriptionFeed } from '../subscription-feed';

function renderSubscriptionFeed() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(
    subscriptionFeedQueryOptions(api).queryKey,
    feedPages([videoSummary({ title: 'From a subscription' })])
  );

  return renderPage(<SubscriptionFeed />, AppProvidersWithToasts, { queryClient });
}

describe('apps/client/web: subscription feed', () => {
  it('shows the videos of the subscribed channels under its heading', async () => {
    const markup = await renderSubscriptionFeed();

    expect(markup).toContain('>Subscription videos</h1>');
    expect(markup).toContain('From a subscription');
  });
});
