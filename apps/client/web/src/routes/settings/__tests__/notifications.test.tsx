import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const render = (headers?: HeadersInit) =>
  serverRender(getRouter, '/settings/notifications', { handlers: loaderApi(), headers });

describe('apps/client/web: /settings/notifications', () => {
  it('asks a guest to sign in, and comes back here once they have', async () => {
    const { status, main } = await render();

    expect(status).toBe(200);
    expect(main).toContain('>Notifications</h1>');
    expect(main).toMatch(
      /<a[^>]*href="\/login\?redirect=%2Fsettings%2Fnotifications"[^>]*>Sign in<\/a>/
    );
  });

  it('gives a signed-in viewer the section itself', async () => {
    const { main } = await render({ cookie: SESSION });

    expect(main).toContain('>Notifications</h1>');
    expect(main).not.toContain('Sign in');
  });
});
