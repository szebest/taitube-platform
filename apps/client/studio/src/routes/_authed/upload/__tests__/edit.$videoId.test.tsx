import { VIDEO_ID } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

describe('apps/client/studio: /upload/edit/$videoId', () => {
  it.each([
    { scenario: 'a video id', path: `/upload/edit/${VIDEO_ID}`, status: 200 },
    { scenario: 'a segment that is not a video id', path: '/upload/edit/nope', status: 404 },
  ])('answers $scenario with $status, in the narrowed layout', async ({ path, status }) => {
    const rendered = await serverRender(getRouter, path);

    expect(rendered.status).toBe(status);
    expect(rendered.main).toContain('max-width:1280px');
  });
});
