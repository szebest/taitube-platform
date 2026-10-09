import type { QueryClient } from '@tanstack/react-query';
import { stubBrowser } from '#app/__tests__/browser';
import { feedPages, videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { SubscriptionVideosPage } from '../subscription-videos-page';

function loaded(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(
    subscriptionFeedQueryOptions().queryKey,
    feedPages([videoSummary({ title: 'From a subscription' })])
  );
  return queryClient;
}

describe('apps/web: subscription videos page', () => {
  it('shows the videos of the subscribed channels', async () => {
    const markup = await renderPage(<SubscriptionVideosPage />, { queryClient: loaded() });

    expect(markup).toContain('Subscription videos:');
    expect(markup).toContain('From a subscription');
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(await renderPage(<SubscriptionVideosPage />, { queryClient: loaded() })).toContain(
      'bi-grid-3x2-gap-fill'
    );
  });
});
