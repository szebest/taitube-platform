import { stubBrowser } from '../../../../../__tests__/browser';
import { createApiStore, seed } from '../../../../../__tests__/api-store';
import { videoSummary } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
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

    const markup = await renderPage(<SubscriptionVideosPage />, { store });

    expect(markup).toContain('Subscription videos:');
    expect(markup).toContain('From a subscription');
  });

  it('shows the spinner while the first page loads', async () => {
    expect(await renderPage(<SubscriptionVideosPage />)).toContain('aria-label="Loading"');
  });

  it('server-renders the grid view marked, whatever the viewer chose', async () => {
    stubBrowser({ stored: { [IN_VIEW_LOCAL_STORAGE_KEY]: 'true' } });

    expect(await renderPage(<SubscriptionVideosPage />)).toContain('bi-grid-3x2-gap-fill');
  });
});
