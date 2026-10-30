import { serverRender } from '@vp/web-testing/server';

import { accountOf, SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: members-only layout', () => {
  it("sends a guest to the studio's own sign-in from the server", async () => {
    const { status, location } = await serverRender(getRouter, '/upload');

    expect(status).toBe(307);
    expect(location).toBe('/login?redirect=%2Fupload');
  });

  it('renders the page on the server for a signed-in creator', async () => {
    const { status, main } = await serverRender(getRouter, '/upload', {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(200);
    expect(main).toContain('Video title');
  });
});
