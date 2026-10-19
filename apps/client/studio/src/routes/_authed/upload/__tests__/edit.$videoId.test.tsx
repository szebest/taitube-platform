import { getVideo } from '@vp/api-contracts';
import { VIDEO_ID, mockEndpoint, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: /upload/edit/$videoId', () => {
  it.each([
    { scenario: 'a video id', path: `/upload/edit/${VIDEO_ID}`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/upload/edit/nope', status: 404 },
  ])('answers $scenario with $status, in the narrowed layout', async ({ path, status }) => {
    const rendered = await serverRender(getRouter, path, {
      handlers: [accountOf(), mockEndpoint(getVideo, () => HttpResponse.json(video()))],
      headers: { cookie: SESSION },
    });

    expect(rendered.status).toBe(status);
    expect(rendered.main).toContain('max-width:1280px');
  });
});
