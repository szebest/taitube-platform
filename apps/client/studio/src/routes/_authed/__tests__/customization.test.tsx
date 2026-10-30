import { serverRender } from '@vp/web-testing/server';

import { SESSION, accountOf } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: /customization', () => {
  it('renders the channel sections on the server, in the narrowed layout', async () => {
    const { status, main } = await serverRender(getRouter, '/customization', {
      handlers: [accountOf()],
      headers: { cookie: SESSION },
    });

    expect(status).toBe(200);
    expect(main).toContain('max-width:960px');
    expect(main).toContain('Name and handle');
  });

  it('sends a guest to sign in and back', async () => {
    const { status, location } = await serverRender(getRouter, '/customization');

    expect(status).toBe(307);
    expect(location).toContain('/login?redirect=%2Fcustomization');
  });
});
