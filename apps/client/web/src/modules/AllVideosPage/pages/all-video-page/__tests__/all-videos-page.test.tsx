import type { QueryClient } from '@tanstack/react-query';
import { stubBrowser } from '#app/__tests__/browser';
import { feedPages, videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { categoriesQueryOptions } from '#app/features/categories/api/category-queries';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { AllVideosPage } from '../all-videos-page';

function loaded(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(categoriesQueryOptions().queryKey, []);
  queryClient.setQueryData(
    publicFeedQueryOptions({ sort: 'recent' }).queryKey,
    feedPages([videoSummary({ title: 'Newest upload' })])
  );
  return queryClient;
}

describe('apps/client/web: all videos page', () => {
  it('shows the newest public videos under the category filter', async () => {
    const markup = await renderPage(<AllVideosPage />, { queryClient: loaded() });

    expect(markup).toContain('All videos:');
    expect(markup.indexOf('>All<')).toBeLessThan(markup.indexOf('Newest upload'));
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(await renderPage(<AllVideosPage />, { queryClient: loaded() })).toContain(
      'bi-grid-3x2-gap-fill'
    );
  });
});
