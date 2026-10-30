import { VIDEO_ID, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { serveEditor } from '#app/features/videos/__tests__/edit-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: /upload/edit/$videoId', () => {
  it('redirects a signed-in creator to the editor of the same video', async () => {
    serveEditor(video());

    const { status, location } = await serverRender(getRouter, `/upload/edit/${VIDEO_ID}`, {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(307);
    expect(location).toBe(`/videos/${VIDEO_ID}/edit`);
  });

  it('answers a segment that is not a video id with 404, and asks for no video', async () => {
    const { status } = await serverRender(getRouter, '/upload/edit/nope', {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(404);
  });
});
