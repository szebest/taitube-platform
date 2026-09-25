import { stubBrowser } from '#app/__tests__/browser';
import { createApiStore, seed } from '#app/__tests__/api-store';
import { videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { feedApi } from '#app/modules/shared/api/feed-api';
import { AllVideosPage } from '../all-videos-page';

describe('apps/web: all videos page', () => {
  it('shows the newest public videos under the category filter', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(feedApi.endpoints.publicFeed.initiate({ sort: 'recent' })),
      { items: [videoSummary({ title: 'Newest upload' })], nextCursor: null, total: 1 }
    );

    const markup = await renderPage(<AllVideosPage />, { store });

    expect(markup).toContain('All videos:');
    expect(markup.indexOf('>All<')).toBeLessThan(markup.indexOf('Newest upload'));
  });

  it('shows the spinner while the first page loads', async () => {
    expect(await renderPage(<AllVideosPage />)).toContain('aria-label="Loading"');
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(await renderPage(<AllVideosPage />)).toContain('bi-grid-3x2-gap-fill');
  });
});
