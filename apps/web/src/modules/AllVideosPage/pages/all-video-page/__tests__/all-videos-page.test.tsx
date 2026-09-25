import { createApiStore, seed } from '../../../../../__tests__/api-store';
import { videoSummary } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { storeValue } from '../../../../../__tests__/stored-value';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '../../../../../config';
import { feedApi } from '../../../../shared/api/feed-api';
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

  it.each([
    { stored: false, gridIcon: 'bi-grid-3x2-gap-fill' },
    { stored: true, gridIcon: 'bi-grid-3x2-gap"' },
  ])('marks the view the viewer chose, list=$stored', async ({ stored, gridIcon }) => {
    storeValue(IN_VIEW_LOCAL_STORAGE_KEY, stored);

    expect(await renderPage(<AllVideosPage />)).toContain(gridIcon);
  });
});
