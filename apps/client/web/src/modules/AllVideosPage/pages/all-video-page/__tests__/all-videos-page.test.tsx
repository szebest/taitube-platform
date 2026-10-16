import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { feedPages, videoSummary } from '@vp/web-testing';
import { api } from '@vp/web-testing';
import { stubBrowser } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { categoriesQueryOptions } from '#app/features/categories/api/category-queries';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { AllVideosPage } from '../all-videos-page';

function loaded(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(categoriesQueryOptions(api).queryKey, []);
  queryClient.setQueryData(
    publicFeedQueryOptions(api, { sort: 'recent' }).queryKey,
    feedPages([videoSummary({ title: 'Newest upload' })])
  );
  return queryClient;
}

describe('apps/client/web: all videos page', () => {
  it('shows the newest public videos under the category filter', async () => {
    const markup = await renderPage(<AllVideosPage />, AppProviders, { queryClient: loaded() });

    expect(markup).toContain('All videos:');
    expect(markup.indexOf('>All<')).toBeLessThan(markup.indexOf('Newest upload'));
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' });

    expect(await renderPage(<AllVideosPage />, AppProviders, { queryClient: loaded() })).toContain(
      'bi-grid-3x2-gap-fill'
    );
  });
});
