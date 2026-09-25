import { createApiStore, seed } from '../../../../../__tests__/api-store';
import { videoSummary } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { storeValue } from '../../../../../__tests__/stored-value';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '../../../../../config';
import { feedApi } from '../../../../shared/api/feed-api';
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

  it.each([
    { stored: false, gridIcon: 'bi-grid-3x2-gap-fill' },
    { stored: true, gridIcon: 'bi-grid-3x2-gap"' },
  ])('marks the view the viewer chose, list=$stored', async ({ stored, gridIcon }) => {
    storeValue(IN_VIEW_LOCAL_STORAGE_KEY, stored);

    expect(await renderPage(<TrendingPage />)).toContain(gridIcon);
  });
});
