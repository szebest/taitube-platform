import { screen } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: VideoAnalyticsPage', () => {
  it('shows one video: its figures, its daily views and its retention, for the range asked', async () => {
    const requests = serveAnalytics();
    await renderRoute(getRouter, `/videos/${VIDEO_ID}/analytics?range=90d`, {
      handlers: [signInBrowser()],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Video analytics' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Audience retention')).toBeInTheDocument();
    expect(await screen.findByText('Views, last 90 days')).toBeInTheDocument();
    expect(requests.every(({ scope, range }) => scope === 'video' && range === '90d')).toBe(true);
  });

  it('switches the range from the control, keeping the video', async () => {
    serveAnalytics();
    const { router, user } = await renderRoute(
      getRouter,
      `/videos/${VIDEO_ID}/analytics?range=90d`,
      {
        handlers: [signInBrowser()],
      }
    );

    await user.click(await screen.findByRole('radio', { name: '7 days' }));

    await vi.waitFor(() => expect(router.state.location.search).toEqual({ range: '7d' }));
    expect(router.state.location.pathname).toBe(`/videos/${VIDEO_ID}/analytics`);
  });
});
