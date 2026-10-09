import type { QueryClient } from '@tanstack/react-query';
import { stubBrowser } from '#app/__tests__/browser';
import { feedPages, videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { type PublicFeedFilter, publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { TrendingPage } from '../trending-page';

function withFeed(queryClient: QueryClient, filter: PublicFeedFilter, title: string): void {
  queryClient.setQueryData(
    publicFeedQueryOptions(filter).queryKey,
    feedPages([videoSummary({ title })])
  );
}

function loaded(): QueryClient {
  const queryClient = createQueryClient();
  withFeed(queryClient, { sort: 'trending' }, 'Going viral');
  withFeed(queryClient, { sort: 'recent' }, 'Just uploaded');
  return queryClient;
}

describe('apps/web: trending page', () => {
  it('shows the trending feed, not the newest one', async () => {
    const markup = await renderPage(<TrendingPage />, { queryClient: loaded() });

    expect(markup).toContain('Trending videos:');
    expect(markup).toContain('Going viral');
    expect(markup).not.toContain('Just uploaded');
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(await renderPage(<TrendingPage />, { queryClient: loaded() })).toContain(
      'bi-grid-3x2-gap-fill'
    );
  });
});
