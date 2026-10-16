import { serverRender } from '@vp/web-testing/server';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: /login', () => {
  it("offers a guest the studio's own sign-in, with the dev personas while the dev server runs", async () => {
    const { status, html } = await serverRender(getRouter, '/login?redirect=%2Fupload');

    expect(status).toBe(200);
    expect(html).toContain('<title>Sign in - Taitube Studio</title>');
    expect(html).toContain('Sign in as a dev persona');
  });

  it('sends a signed-in creator on to where the sign-in was asked for', async () => {
    const { status, location } = await serverRender(getRouter, '/login?redirect=%2Fupload', {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(307);
    expect(location).toBe('/upload');
  });
});
