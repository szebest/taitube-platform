import { stubBrowser } from '#app/__tests__/browser';
import { createApiStore, seed } from '#app/__tests__/api-store';
import { videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '#app/config';
import { feedApi } from '#app/modules/shared/api/feed-api';
import { TrendingPage } from '../trending-page';

describe('apps/web: trending page', () => {
  it('shows the trending feed, not the newest one', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(feedApi.endpoints.publicFeed.initiate({ sort: 'trending' })),
      { items: [videoSummary({ title: 'Going viral' })], nextCursor: null, total: 1 }
    );
    await seed(
      store,
      (target) => target.dispatch(feedApi.endpoints.publicFeed.initiate({ sort: 'recent' })),
      { items: [videoSummary({ title: 'Just uploaded' })], nextCursor: null, total: 1 }
    );

    const markup = await renderPage(<TrendingPage />, { store });

    expect(markup).toContain('Trending videos:');
    expect(markup).toContain('Going viral');
    expect(markup).not.toContain('Just uploaded');
  });

  it('shows the spinner while the first page loads', async () => {
    expect(await renderPage(<TrendingPage />)).toContain('aria-label="Loading"');
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(await renderPage(<TrendingPage />)).toContain('bi-grid-3x2-gap-fill');
  });
});
