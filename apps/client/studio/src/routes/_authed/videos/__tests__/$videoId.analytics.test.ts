import { getVideoRetention } from '@vp/api-contracts';
import { VIDEO_ID, mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

function renderAnalytics(path: string) {
  return serverRender(getRouter, path, {
    handlers: [
      accountOf(),
      mockEndpoint(getVideoRetention, () =>
        HttpResponse.json({
          videoId: VIDEO_ID,
          curve: [
            { percent: 0, viewers: 10 },
            { percent: 100, viewers: 5 },
          ],
        })
      ),
    ],
    headers: { cookie: SESSION },
  });
}

describe('apps/client/studio: /videos/$videoId/analytics', () => {
  it.each([
    { scenario: 'a video id', path: `/videos/${VIDEO_ID}/analytics`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/videos/nope/analytics', status: 404 },
  ])('answers $scenario with $status', async ({ path, status }) => {
    const rendered = await renderAnalytics(path);

    expect(rendered.status).toBe(status);
  });

  it('server-renders the retention curve the loader fetched', async () => {
    const rendered = await renderAnalytics(`/videos/${VIDEO_ID}/analytics`);

    expect(rendered.main).toContain('points="0,0 100,20"');
  });
});
