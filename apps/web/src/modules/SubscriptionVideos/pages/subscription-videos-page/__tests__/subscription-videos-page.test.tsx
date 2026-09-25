import { createApiStore, seed } from '../../../../../__tests__/api-store';
import { videoSummary } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { storeValue } from '../../../../../__tests__/stored-value';
import { IN_VIEW_LOCAL_STORAGE_KEY } from '../../../../../config';
import { feedApi } from '../../../../shared/api/feed-api';
import { SubscriptionVideosPage } from '../subscription-videos-page';

describe('apps/web: subscription videos page', () => {
  it('shows the videos of the subscribed channels', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(feedApi.endpoints.subscriptionFeed.initiate({ limit: 30 })),
      { items: [videoSummary({ title: 'From a subscription' })], nextCursor: null, total: 1 }
    );

    const markup = renderPage(<SubscriptionVideosPage />, { store });

    expect(markup).toContain('Subscription videos:');
    expect(markup).toContain('From a subscription');
  });

  it('shows the spinner while the first page loads', () => {
    expect(renderPage(<SubscriptionVideosPage />)).toContain('aria-label="Loading"');
  });

  it.each([
    { stored: false, gridIcon: 'bi-grid-3x2-gap-fill' },
    { stored: true, gridIcon: 'bi-grid-3x2-gap"' },
  ])('marks the view the viewer chose, list=$stored', ({ stored, gridIcon }) => {
    storeValue(IN_VIEW_LOCAL_STORAGE_KEY, stored);

    expect(renderPage(<SubscriptionVideosPage />)).toContain(gridIcon);
  });
});
