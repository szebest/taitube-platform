import { serverRender } from '@vp/web-testing/server';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: members-only layout', () => {
  it("sends a guest to the studio's own sign-in from the server", async () => {
    const { status, location } = await serverRender(getRouter, '/upload');

    expect(status).toBe(307);
    expect(location).toBe('/login?redirect=%2Fupload');
  });

  it('renders the page on the server for a signed-in creator', async () => {
    serveLibrary([{ cursor: null, items: [], next: null }]);

    const { status, main } = await serverRender(getRouter, '/videos?sort=newest&page=1', {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(200);
    expect(main).toContain('Your videos');
  });
});
