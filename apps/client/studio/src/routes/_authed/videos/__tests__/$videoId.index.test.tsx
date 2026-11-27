import { VIDEO_ID } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { SESSION, accountOf } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: /videos/$videoId', () => {
  it('sends a signed-in creator to the library, which is where a video address with nothing after it belongs', async () => {
    const { status, location } = await serverRender(getRouter, `/videos/${VIDEO_ID}`, {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(307);
    expect(location).toBe('/videos');
  });

  it('answers a segment that is not a video id with 404', async () => {
    const { status } = await serverRender(getRouter, '/videos/nope', {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(404);
  });

  it('sends a guest to sign in', async () => {
    const { status, location } = await serverRender(getRouter, `/videos/${VIDEO_ID}`);

    expect(status).toBe(307);
    expect(location).toContain('/login');
  });
});
