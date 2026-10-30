import { VIDEO_ID } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { accountOf, SESSION } from '#app/__tests__/providers';
import { analyticsHandlers } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { getRouter } from '#app/router';

function renderAnalytics(path: string) {
  const { handlers } = analyticsHandlers({ views: [10, 20], retention: [10, 5] });
  return serverRender(getRouter, path, {
    handlers: [accountOf(), ...handlers],
    headers: { cookie: SESSION },
  });
}

describe('apps/client/studio: /videos/$videoId/analytics', () => {
  it.each([
    { scenario: 'a video id', path: `/videos/${VIDEO_ID}/analytics?range=30d`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/videos/nope/analytics?range=30d', status: 404 },
  ])('answers $scenario with $status', async ({ path, status }) => {
    const rendered = await renderAnalytics(path);

    expect(rendered.status).toBe(status);
  });

  it('server-renders the numbers the loader fetched, for the range in the address', async () => {
    const rendered = await renderAnalytics(`/videos/${VIDEO_ID}/analytics?range=7d`);

    expect(rendered.main).toContain('Video analytics');
    expect(rendered.main).toContain('Views, last 7 days');
    expect(rendered.main).toContain('Audience retention');
  });
});
