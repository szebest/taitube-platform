import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { feedPages, videoSummary } from '@vp/web-testing';
import { api } from '@vp/web-testing';
import { stubBrowser } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { subscriptionFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { SubscriptionVideosPage } from '../subscription-videos-page';

function loaded(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(
    subscriptionFeedQueryOptions(api).queryKey,
    feedPages([videoSummary({ title: 'From a subscription' })])
  );
  return queryClient;
}

describe('apps/client/web: subscription videos page', () => {
  it('shows the videos of the subscribed channels', async () => {
    const markup = await renderPage(<SubscriptionVideosPage />, AppProviders, {
      queryClient: loaded(),
    });

    expect(markup).toContain('Subscription videos:');
    expect(markup).toContain('From a subscription');
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' });

    expect(
      await renderPage(<SubscriptionVideosPage />, AppProviders, { queryClient: loaded() })
    ).toContain('bi-grid-3x2-gap-fill');
  });
});
