import { createQueryClient, videoRetentionQueryOptions } from '@vp/queries';
import { VIDEO_ID, api } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { AnalyticsPage } from '../analytics-page';

function renderAnalyticsPage(curve: { percent: number; viewers: number }[]): Promise<string> {
  const queryClient = createQueryClient();
  queryClient.setQueryData(videoRetentionQueryOptions(api, VIDEO_ID).queryKey, {
    videoId: VIDEO_ID,
    curve,
  });

  return renderPage(<AnalyticsPage />, AppProviders, {
    queryClient,
    url: `/videos/${VIDEO_ID}/analytics`,
    route: '/videos/$videoId/analytics',
    layout: '_authed',
  });
}

describe('apps/client/studio: analytics page', () => {
  it('draws the retention curve the loader put in the cache', async () => {
    const markup = await renderAnalyticsPage([
      { percent: 0, viewers: 4 },
      { percent: 100, viewers: 1 },
    ]);

    expect(markup).toContain('Audience retention');
    expect(markup).toContain('points="0,0 100,30"');
  });
});
